const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const cache = require('../utils/cache');

const dashboardController = {
  getKPIs: async (req, res) => {
    try {
      const year = req.query.year || 'All';

      let cacheKey = `dashboard_kpis_${year}`;

      if (req.user) {
        if (req.user.role === 'Party' && req.user.party_name) {
          cacheKey += `_party_${req.user.party_name}`;
        } else if (req.user.role === 'VCN' && req.user.vcn) {
          cacheKey += `_vcn_${req.user.vcn}`;
        }
      }

      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const timerLabel = `dashboard-api-${year}-${Date.now()}`;
      console.time(timerLabel);
      // ---------------------------------------------------------
      // LOCAL YEAR FILTER FIX
      // Do NOT use old getYearFilter here.
      // The database uses source_year, so all dashboard queries
      // must filter using source_year.
      // ---------------------------------------------------------

      const buildBaseFilter = () => {
        const conditions = [];
        const replacements = {};

        const selectedYear = String(year).trim();

        if (
          selectedYear &&
          selectedYear !== 'All' &&
          selectedYear !== 'All Fiscal Years'
        ) {
          if (selectedYear === 'Recent4') {
            conditions.push('source_year BETWEEN :startYear AND :endYear');
            replacements.startYear = 2021;
            replacements.endYear = 2024;
          } else {
            const numericYear = parseInt(selectedYear, 10);

            if (!Number.isNaN(numericYear)) {
              conditions.push('source_year = :selectedYear');
              replacements.selectedYear = numericYear;
            }
          }
        }

        if (req.user) {
          if (req.user.role === 'Party' && req.user.party_name) {
            conditions.push('party_name = :partyName');
            replacements.partyName = req.user.party_name;
          }

          if (req.user.role === 'VCN' && req.user.vcn) {
            conditions.push('vcn = :vcn');
            replacements.vcn = req.user.vcn;
          }
        }

        return {
          whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
          andClause: conditions.length ? `AND ${conditions.join(' AND ')}` : '',
          replacements
        };
      };

      const filter = buildBaseFilter();

      const formatCurrency = (num) => {
        const value = Number(num) || 0;

        if (value >= 1.0e9) return `₹${(value / 1.0e9).toFixed(2)} B`;
        if (value >= 1.0e7) return `₹${(value / 1.0e7).toFixed(2)} Cr`;
        if (value >= 1.0e5) return `₹${(value / 1.0e5).toFixed(2)} L`;

        return `₹${value.toLocaleString('en-IN')}`;
      };

      const categoryExpression = `
        COALESCE(
          NULLIF(TRIM(commodity_group), ''),
          NULLIF(TRIM(commodity), '')
        )
      `;

      const serviceKeywords = [
        'PILOTAGE',
        'ANCHORAGE',
        'TOWAGE',
        'PORT DUES',
        'FRESH WATER',
        'CREW CHANGE',
        'BERTH HIRE',
        'MARINE SPECIAL SERVICE',
        'CARGO SPECIAL SERVICE',
        'CARGO SPECIAL SERVICES',
        'COMPOSITE MARITIME',
        'STORAGE',
        'GROUND RENT',
        'WHARFAGE',
        'DEMURRAGE',
        'INVOICE',
        'CHARGE',
        'CHARGES',
        'HANDLING',
        'SECURITY',
        'VCN CANCELLATION',
        'CANCELLATION',
        'BUFFER YARD',
        'RAMP EXAMINATION',
        'WEIGHMENT',
        'STUFF',
        'DESTUFF',
        'SHIFTING',
        'COLD MOVEMENT',
        'REEFER'
      ];

      const serviceFilterSql = serviceKeywords
        .map((_, index) => `UPPER(category) NOT LIKE :servicePattern${index}`)
        .join(' AND ');

      const serviceFilterSqlSelect = serviceKeywords
        .map((_, index) => `UPPER(${categoryExpression}) NOT LIKE :servicePattern${index}`)
        .join(' AND ');

      const serviceReplacements = {};
      serviceKeywords.forEach((keyword, index) => {
        serviceReplacements[`servicePattern${index}`] = `%${keyword}%`;
      });

      // ---------------------------------------------------------
      // Run all independent SQL queries in PARALLEL for maximum speed
      // ---------------------------------------------------------
      const [
        combinedResult,
        grtResult,
        topBerthResult,
        topCommodityResult,
        topCustomerResult,
        scopeYearlyRevenues
      ] = await Promise.all([
        // 1. Combined Core KPIs
        sequelize.query(
          `SELECT
            COALESCE(SUM(invoice_amount), 0) AS totalRevenue,
            COUNT(*) AS totalTransactions,
            COUNT(DISTINCT CASE WHEN vessel_name IS NOT NULL AND TRIM(vessel_name) != '' THEN vessel_name END) AS totalVessels,
            COUNT(DISTINCT CASE WHEN party_name IS NOT NULL AND TRIM(party_name) != '' THEN party_name END) AS totalCustomers,
            COUNT(DISTINCT CASE WHEN berth IS NOT NULL AND TRIM(berth) != '' THEN berth END) AS totalBerths
          FROM PortRecords
          ${filter.whereClause}`,
          { type: QueryTypes.SELECT, replacements: filter.replacements }
        ),
        // 2. Total GRT
        sequelize.query(
          `SELECT COALESCE(SUM(max_grt), 0) AS totalGRT
          FROM (
            SELECT vcn, MAX(grt) AS max_grt
            FROM PortRecords
            WHERE vcn IS NOT NULL AND TRIM(vcn) != ''
            ${filter.andClause}
            GROUP BY vcn
          ) AS t`,
          { type: QueryTypes.SELECT, replacements: filter.replacements }
        ),
        // 3. Top Berth
        sequelize.query(
          `SELECT berth, COALESCE(SUM(invoice_amount), 0) AS revenue
          FROM PortRecords
          WHERE berth IS NOT NULL AND TRIM(berth) != ''
          ${filter.andClause}
          GROUP BY berth ORDER BY revenue DESC LIMIT 1`,
          { type: QueryTypes.SELECT, replacements: filter.replacements }
        ),
        // 4. Commodity Revenues (grouped for top commodity & total commodities count)
        sequelize.query(
          `SELECT ${categoryExpression} AS category, COALESCE(SUM(invoice_amount), 0) AS revenue
          FROM PortRecords
          ${filter.whereClause}
          GROUP BY category`,
          { type: QueryTypes.SELECT, replacements: filter.replacements }
        ),
        // 5. Top Customer
        sequelize.query(
          `SELECT party_name, COALESCE(SUM(invoice_amount), 0) AS revenue
          FROM PortRecords
          WHERE party_name IS NOT NULL AND TRIM(party_name) != ''
          ${filter.andClause}
          GROUP BY party_name ORDER BY revenue DESC LIMIT 1`,
          { type: QueryTypes.SELECT, replacements: filter.replacements }
        ),
        // 6. Yearly Revenue
        sequelize.query(
          `SELECT source_year AS year, COALESCE(SUM(invoice_amount), 0) AS revenue
          FROM PortRecords
          ${filter.whereClause}
          GROUP BY source_year
          HAVING source_year IS NOT NULL
          ORDER BY source_year ASC`,
          { type: QueryTypes.SELECT, replacements: filter.replacements }
        )
      ]);

      const serviceKeywordsUpper = serviceKeywords.map(k => k.toUpperCase());

      // Filter commodity revenues in memory to exclude services
      const filteredCommodityRevenues = topCommodityResult
        .map(r => ({
          commodity: (r.category || '').trim(),
          revenue: parseFloat(r.revenue) || 0
        }))
        .filter(r => {
          if (!r.commodity) return false;
          const upperCat = r.commodity.toUpperCase();
          return !serviceKeywordsUpper.some(k => upperCat.includes(k));
        });

      const totalRevenue = parseFloat(combinedResult[0]?.totalRevenue) || 0;
      const totalTransactions = parseInt(combinedResult[0]?.totalTransactions, 10) || 0;
      const totalVessels = parseInt(combinedResult[0]?.totalVessels, 10) || 0;
      const totalCustomers = parseInt(combinedResult[0]?.totalCustomers, 10) || 0;
      const totalBerths = parseInt(combinedResult[0]?.totalBerths, 10) || 0;
      const totalCommodities = filteredCommodityRevenues.length;
      const totalGRT = parseFloat(grtResult[0]?.totalGRT) || 0;
      const topBerth = topBerthResult[0]?.berth || 'N/A';
      
      // Sort in descending order to get top commodity
      filteredCommodityRevenues.sort((a, b) => b.revenue - a.revenue);
      const topCommodity = filteredCommodityRevenues[0]?.commodity || 'N/A';
      const topCustomer = topCustomerResult[0]?.party_name || 'N/A';

      let cagr = 0;
      let overallGrowth = 0;
      let growthPercentage = 0;

      if (scopeYearlyRevenues.length >= 2) {
        const firstRow = scopeYearlyRevenues[0];
        const lastRow = scopeYearlyRevenues[scopeYearlyRevenues.length - 1];
        const firstRev = parseFloat(firstRow.revenue) || 0;
        const lastRev = parseFloat(lastRow.revenue) || 0;
        const firstYearVal = parseInt(firstRow.year, 10);
        const lastYearVal = parseInt(lastRow.year, 10);
        const nYears = lastYearVal - firstYearVal;
        if (firstRev > 0 && lastRev > 0) {
          overallGrowth = ((lastRev - firstRev) / firstRev) * 100;
          if (nYears > 0) cagr = (Math.pow(lastRev / firstRev, 1 / nYears) - 1) * 100;
          if (String(year) === 'All' || String(year) === 'All Fiscal Years' || String(year) === 'Recent4') {
            growthPercentage = cagr;
          } else {
            growthPercentage = overallGrowth;
          }
        }
      }

      let highestRevenueYear = 'N/A';
      if (scopeYearlyRevenues.length > 0) {
        const highestYearRow = scopeYearlyRevenues.reduce((best, current) => {
          return (parseFloat(current.revenue) || 0) > (parseFloat(best.revenue) || 0) ? current : best;
        }, scopeYearlyRevenues[0]);
        highestRevenueYear = highestYearRow?.year || 'N/A';
      }

      const availableYears = scopeYearlyRevenues
        .map((row) => parseInt(row.year, 10))
        .filter((value) => !Number.isNaN(value));
      const latestYear = availableYears.length ? availableYears[availableYears.length - 1] : null;
      const prevYear = availableYears.length > 1 ? availableYears[availableYears.length - 2] : null;

      // Run growth + risk queries in parallel (only if we have two years to compare)
      let fastestGrowingCommodity = 'N/A';
      let largestBusinessRisk = 'None';

      if (latestYear && prevYear) {
        const [growthRows, customerLosses] = await Promise.all([
          sequelize.query(
            `SELECT ${categoryExpression} AS category,
              SUM(CASE WHEN source_year = :prevYear THEN invoice_amount ELSE 0 END) AS prevRev,
              SUM(CASE WHEN source_year = :latestYear THEN invoice_amount ELSE 0 END) AS latestRev
            FROM PortRecords
            ${filter.whereClause}
            GROUP BY category`,
            { type: QueryTypes.SELECT, replacements: { ...filter.replacements, prevYear, latestYear } }
          ),
          sequelize.query(
            `SELECT party_name,
              SUM(CASE WHEN source_year = :prevYear THEN invoice_amount ELSE 0 END) AS prevRev,
              SUM(CASE WHEN source_year = :latestYear THEN invoice_amount ELSE 0 END) AS latestRev
            FROM PortRecords
            WHERE party_name IS NOT NULL AND TRIM(party_name) != ''
            AND source_year IN (:prevYear, :latestYear)
            ${filter.andClause}
            GROUP BY party_name`,
            { type: QueryTypes.SELECT, replacements: { ...filter.replacements, prevYear, latestYear } }
          )
        ]);

        const filteredGrowthRows = growthRows.filter(row => {
          const cat = (row.category || '').trim();
          if (!cat) return false;
          const upperCat = cat.toUpperCase();
          return !serviceKeywordsUpper.some(k => upperCat.includes(k));
        });

        let maxGrowth = -Infinity;
        filteredGrowthRows.forEach((row) => {
          const prev = parseFloat(row.prevRev) || 0;
          const latest = parseFloat(row.latestRev) || 0;
          if (prev >= 1000000 && latest > prev) {
            const growth = ((latest - prev) / prev) * 100;
            if (growth > maxGrowth) {
              maxGrowth = growth;
              fastestGrowingCommodity = `${row.category} (+${growth.toFixed(1)}% YoY)`;
            }
          }
        });

        let maxLoss = 0;
        let worstCustomer = '';
        customerLosses.forEach((row) => {
          const prev = parseFloat(row.prevRev) || 0;
          const latest = parseFloat(row.latestRev) || 0;
          if (prev >= 1000000 && latest < prev) {
            const loss = prev - latest;
            if (loss > maxLoss) { maxLoss = loss; worstCustomer = row.party_name; }
          }
        });
        if (worstCustomer) {
          largestBusinessRisk = `Customer revenue decline: ${worstCustomer} (-${formatCurrency(maxLoss)})`;
        }
      }

      const yearlyTrend = scopeYearlyRevenues.map((row) => ({
        year: row.year,
        revenue: parseFloat(row.revenue) || 0
      }));

      const responseData = {
        totalRevenue,
        totalVessels,
        totalCustomers,
        totalBerths,
        totalCommodities,
        totalGRT,
        totalTransactions,
        topBerth,
        topCommodity,
        topCustomer,
        highestRevenueYear,
        growthPercentage: parseFloat(growthPercentage.toFixed(2)),
        cagr: parseFloat(cagr.toFixed(2)),
        overallGrowth: parseFloat(overallGrowth.toFixed(2)),
        fastestGrowingCommodity,
        largestBusinessRisk,
        yearlyTrend
      };

      cache.set(cacheKey, responseData);

      console.timeEnd(timerLabel);
      res.json(responseData);
    } catch (error) {
      console.error('Dashboard KPI error:', error.message);
      res.status(500).json({ error: 'Failed to retrieve dashboard KPIs' });
    }
  }
};

module.exports = dashboardController;