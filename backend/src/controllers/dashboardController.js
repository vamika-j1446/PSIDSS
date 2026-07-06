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

      const serviceReplacements = {};
      serviceKeywords.forEach((keyword, index) => {
        serviceReplacements[`servicePattern${index}`] = `%${keyword}%`;
      });

      // ---------------------------------------------------------
      // 1. Total Revenue and Transactions
      // ---------------------------------------------------------

      const revenueResult = await sequelize.query(
        `
        SELECT
          COALESCE(SUM(invoice_amount), 0) AS totalRevenue,
          COUNT(*) AS totalTransactions
        FROM PortRecords
        ${filter.whereClause}
        `,
        {
          type: QueryTypes.SELECT,
          replacements: filter.replacements
        }
      );

      const totalRevenue = parseFloat(revenueResult[0]?.totalRevenue) || 0;
      const totalTransactions = parseInt(revenueResult[0]?.totalTransactions, 10) || 0;

      // ---------------------------------------------------------
      // 2. Total Vessels
      // ---------------------------------------------------------

      const vesselResult = await sequelize.query(
        `
        SELECT COUNT(DISTINCT vessel_name) AS totalVessels
        FROM PortRecords
        WHERE vessel_name IS NOT NULL
        AND TRIM(vessel_name) != ''
        ${filter.andClause}
        `,
        {
          type: QueryTypes.SELECT,
          replacements: filter.replacements
        }
      );

      const totalVessels = parseInt(vesselResult[0]?.totalVessels, 10) || 0;

      // ---------------------------------------------------------
      // 3. Total Customers
      // ---------------------------------------------------------

      const customerResult = await sequelize.query(
        `
        SELECT COUNT(DISTINCT party_name) AS totalCustomers
        FROM PortRecords
        WHERE party_name IS NOT NULL
        AND TRIM(party_name) != ''
        ${filter.andClause}
        `,
        {
          type: QueryTypes.SELECT,
          replacements: filter.replacements
        }
      );

      const totalCustomers = parseInt(customerResult[0]?.totalCustomers, 10) || 0;

      // ---------------------------------------------------------
      // 4. Total Berths
      // ---------------------------------------------------------

      const berthResult = await sequelize.query(
        `
        SELECT COUNT(DISTINCT berth) AS totalBerths
        FROM PortRecords
        WHERE berth IS NOT NULL
        AND TRIM(berth) != ''
        ${filter.andClause}
        `,
        {
          type: QueryTypes.SELECT,
          replacements: filter.replacements
        }
      );

      const totalBerths = parseInt(berthResult[0]?.totalBerths, 10) || 0;

      // ---------------------------------------------------------
      // 5. Total Commodity/Cargo Categories
      // Uses commodity_group first, then commodity.
      // Excludes billing/service entries.
      // ---------------------------------------------------------

      const commodityResult = await sequelize.query(
        `
        SELECT COUNT(DISTINCT category) AS totalCommodities
        FROM (
          SELECT ${categoryExpression} AS category
          FROM PortRecords
          ${filter.whereClause}
        ) AS t
        WHERE category IS NOT NULL
        AND TRIM(category) != ''
        AND ${serviceFilterSql}
        `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            ...filter.replacements,
            ...serviceReplacements
          }
        }
      );

      const totalCommodities = parseInt(commodityResult[0]?.totalCommodities, 10) || 0;

      // ---------------------------------------------------------
      // 6. Total GRT
      // Sum one GRT per VCN to avoid double counting.
      // ---------------------------------------------------------

      const grtResult = await sequelize.query(
        `
        SELECT COALESCE(SUM(max_grt), 0) AS totalGRT
        FROM (
          SELECT vcn, MAX(grt) AS max_grt
          FROM PortRecords
          WHERE vcn IS NOT NULL
          AND TRIM(vcn) != ''
          ${filter.andClause}
          GROUP BY vcn
        ) AS t
        `,
        {
          type: QueryTypes.SELECT,
          replacements: filter.replacements
        }
      );

      const totalGRT = parseFloat(grtResult[0]?.totalGRT) || 0;

      // ---------------------------------------------------------
      // 7. Top Berth by Revenue
      // ---------------------------------------------------------

      const topBerthResult = await sequelize.query(
        `
        SELECT berth, COALESCE(SUM(invoice_amount), 0) AS revenue
        FROM PortRecords
        WHERE berth IS NOT NULL
        AND TRIM(berth) != ''
        ${filter.andClause}
        GROUP BY berth
        ORDER BY revenue DESC
        LIMIT 1
        `,
        {
          type: QueryTypes.SELECT,
          replacements: filter.replacements
        }
      );

      const topBerth = topBerthResult[0]?.berth || 'N/A';

      // ---------------------------------------------------------
      // 8. Top Commodity/Cargo Category by Revenue
      // Uses commodity_group first, then commodity.
      // Excludes services and billing charge names.
      // ---------------------------------------------------------

      const topCommodityResult = await sequelize.query(
        `
        SELECT category AS commodity, COALESCE(SUM(invoice_amount), 0) AS revenue
        FROM (
          SELECT
            ${categoryExpression} AS category,
            invoice_amount
          FROM PortRecords
          ${filter.whereClause}
        ) AS t
        WHERE category IS NOT NULL
        AND TRIM(category) != ''
        AND ${serviceFilterSql}
        GROUP BY category
        ORDER BY revenue DESC
        LIMIT 1
        `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            ...filter.replacements,
            ...serviceReplacements
          }
        }
      );

      const topCommodity = topCommodityResult[0]?.commodity || 'N/A';

      // ---------------------------------------------------------
      // 9. Top Customer by Revenue
      // ---------------------------------------------------------

      const topCustomerResult = await sequelize.query(
        `
        SELECT party_name, COALESCE(SUM(invoice_amount), 0) AS revenue
        FROM PortRecords
        WHERE party_name IS NOT NULL
        AND TRIM(party_name) != ''
        ${filter.andClause}
        GROUP BY party_name
        ORDER BY revenue DESC
        LIMIT 1
        `,
        {
          type: QueryTypes.SELECT,
          replacements: filter.replacements
        }
      );

      const topCustomer = topCustomerResult[0]?.party_name || 'N/A';

      // ---------------------------------------------------------
      // 10. Yearly Revenue List for Calculations
      // ---------------------------------------------------------

      const scopeYearlyRevenues = await sequelize.query(
        `
        SELECT
          source_year AS year,
          COALESCE(SUM(invoice_amount), 0) AS revenue
        FROM PortRecords
        ${filter.whereClause}
        GROUP BY source_year
        HAVING source_year IS NOT NULL
        ORDER BY source_year ASC
        `,
        {
          type: QueryTypes.SELECT,
          replacements: filter.replacements
        }
      );

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

          if (nYears > 0) {
            cagr = (Math.pow(lastRev / firstRev, 1 / nYears) - 1) * 100;
          }

          if (String(year) === 'All' || String(year) === 'All Fiscal Years' || String(year) === 'Recent4') {
            growthPercentage = cagr;
          } else {
            growthPercentage = overallGrowth;
          }
        }
      }

      // ---------------------------------------------------------
      // 11. Highest Revenue Year
      // ---------------------------------------------------------

      let highestRevenueYear = 'N/A';

      if (scopeYearlyRevenues.length > 0) {
        const highestYearRow = scopeYearlyRevenues.reduce((best, current) => {
          const bestRevenue = parseFloat(best.revenue) || 0;
          const currentRevenue = parseFloat(current.revenue) || 0;
          return currentRevenue > bestRevenue ? current : best;
        }, scopeYearlyRevenues[0]);

        highestRevenueYear = highestYearRow?.year || 'N/A';
      }

      // ---------------------------------------------------------
      // 12. Fastest Growing Revenue Category
      // This replaces incorrect charge_name based logic.
      // ---------------------------------------------------------

      let fastestGrowingCommodity = 'N/A';

      const availableYears = scopeYearlyRevenues
        .map((row) => parseInt(row.year, 10))
        .filter((value) => !Number.isNaN(value));

      const latestYear = availableYears.length ? availableYears[availableYears.length - 1] : null;
      const prevYear = availableYears.length > 1 ? availableYears[availableYears.length - 2] : null;

      if (latestYear && prevYear) {
        const growthRows = await sequelize.query(
          `
          SELECT
            category,
            SUM(CASE WHEN source_year = :prevYear THEN invoice_amount ELSE 0 END) AS prevRev,
            SUM(CASE WHEN source_year = :latestYear THEN invoice_amount ELSE 0 END) AS latestRev
          FROM (
            SELECT
              ${categoryExpression} AS category,
              source_year,
              invoice_amount
            FROM PortRecords
            ${filter.whereClause}
          ) AS t
          WHERE category IS NOT NULL
          AND TRIM(category) != ''
          AND ${serviceFilterSql}
          GROUP BY category
          `,
          {
            type: QueryTypes.SELECT,
            replacements: {
              ...filter.replacements,
              ...serviceReplacements,
              prevYear,
              latestYear
            }
          }
        );

        let maxGrowth = -Infinity;

        growthRows.forEach((row) => {
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
      }

      // ---------------------------------------------------------
      // 13. Largest Business Risk
      // Customer revenue contraction based on latest vs previous year.
      // ---------------------------------------------------------

      let largestBusinessRisk = 'None';

      if (latestYear && prevYear) {
        const customerLosses = await sequelize.query(
          `
          SELECT
            party_name,
            SUM(CASE WHEN source_year = :prevYear THEN invoice_amount ELSE 0 END) AS prevRev,
            SUM(CASE WHEN source_year = :latestYear THEN invoice_amount ELSE 0 END) AS latestRev
          FROM PortRecords
          WHERE party_name IS NOT NULL
          AND TRIM(party_name) != ''
          ${filter.andClause}
          GROUP BY party_name
          `,
          {
            type: QueryTypes.SELECT,
            replacements: {
              ...filter.replacements,
              prevYear,
              latestYear
            }
          }
        );

        let maxLoss = 0;
        let worstCustomer = '';

        customerLosses.forEach((row) => {
          const prev = parseFloat(row.prevRev) || 0;
          const latest = parseFloat(row.latestRev) || 0;

          if (prev >= 1000000 && latest < prev) {
            const loss = prev - latest;

            if (loss > maxLoss) {
              maxLoss = loss;
              worstCustomer = row.party_name;
            }
          }
        });

        if (worstCustomer) {
          largestBusinessRisk = `Customer revenue decline: ${worstCustomer} (-${formatCurrency(maxLoss)})`;
        }
      }

      // ---------------------------------------------------------
      // 14. Yearly Revenue Trend
      // ---------------------------------------------------------

      const yearlyTrend = scopeYearlyRevenues.map((row) => ({
        year: row.year,
        revenue: parseFloat(row.revenue) || 0
      }));

      // ---------------------------------------------------------
      // 15. Debug Output
      // ---------------------------------------------------------

      console.log(`[DEBUG] SQL KPI Query Results (year=${year}):`, {
        totalRevenue,
        totalTransactions,
        totalCustomers,
        totalVessels,
        totalCommodities,
        totalBerths,
        totalGRT,
        topBerth,
        topCommodity,
        topCustomer,
        fastestGrowingCommodity,
        largestBusinessRisk,
        growthPercentage,
        cagr,
        overallGrowth,
        yearlyTrend
      });

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

      res.json(responseData);
    } catch (error) {
      console.error('[DASHBOARD KPI ERROR]', error);
      res.status(500).json({
        error: 'Failed to retrieve dashboard KPIs',
        details: error.message
      });
    }
  }
};

module.exports = dashboardController;