const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const cache = require('../utils/cache');
const { getYearFilter } = require('../utils/filter');
require('dotenv').config();

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

const historicalController = {
  // 1. Multi-year Revenue Trend (YoY)
  getRevenueTrends: async (req, res) => {
    try {
      const year = req.query.year || 'All';
      let cacheKey = `historical_trends_${year}`;
      if (req.user) {
        if (req.user.role === 'Party' && req.user.party_name) cacheKey += `_party_${req.user.party_name}`;
        else if (req.user.role === 'VCN' && req.user.vcn) cacheKey += `_vcn_${req.user.vcn}`;
      }
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);

      const timerLabel = `historical-trends-${year}-${Date.now()}`;
      console.time(timerLabel);

      let f1_yearly = getYearFilter(req, true, '', false);
      const f1_monthly = getYearFilter(req, true, '', false);

      const numericYear = parseInt(year, 10);
      if (!isNaN(numericYear) && year !== 'All' && year !== 'Recent4') {
        const prevYearVal = numericYear - 1;
        const conditions = [];
        const replacements = {};
        conditions.push('source_year IN (:prevYearVal, :selectedYearVal)');
        replacements.prevYearVal = prevYearVal;
        replacements.selectedYearVal = numericYear;

        if (req.user) {
          if (req.user.role === 'Party' && req.user.party_name) {
            conditions.push('party_name = :userPartyName');
            replacements.userPartyName = req.user.party_name;
          } else if (req.user.role === 'VCN' && req.user.vcn) {
            conditions.push('vcn = :userVcn');
            replacements.userVcn = req.user.vcn;
          }
        }
        f1_yearly = {
          clause: ` AND ${conditions.join(' AND ')}`,
          replacements
        };
      }

      let sqlYearly, sqlMonthly;
      if (DB_TYPE === 'mysql') {
        sqlYearly = `SELECT source_year as label, SUM(invoice_amount) as revenue FROM PortRecords WHERE source_year IS NOT NULL AND source_year > 0${f1_yearly.clause} GROUP BY source_year ORDER BY source_year ASC`;
        sqlMonthly = `SELECT DATE_FORMAT(invoice_date, '%Y-%m') as label, SUM(invoice_amount) as revenue FROM PortRecords WHERE invoice_date IS NOT NULL${f1_monthly.clause} GROUP BY label ORDER BY label ASC`;
      } else {
        sqlYearly = `SELECT source_year as label, SUM(invoice_amount) as revenue FROM PortRecords WHERE source_year IS NOT NULL AND source_year > 0${f1_yearly.clause} GROUP BY source_year ORDER BY source_year ASC`;
        sqlMonthly = `SELECT strftime('%Y-%m', invoice_date) as label, SUM(invoice_amount) as revenue FROM PortRecords WHERE invoice_date IS NOT NULL${f1_monthly.clause} GROUP BY label ORDER BY label ASC`;
      }

      // Run both queries in parallel
      const [yearlyData, monthlyData] = await Promise.all([
        sequelize.query(sqlYearly, { type: QueryTypes.SELECT, replacements: f1_yearly.replacements }),
        sequelize.query(sqlMonthly, { type: QueryTypes.SELECT, replacements: f1_monthly.replacements })
      ]);

      const trends = yearlyData.map((d, index) => {
        const currentRev = parseFloat(d.revenue) || 0;
        let growth = 0;
        if (index > 0) {
          const prevRev = parseFloat(yearlyData[index - 1].revenue) || 0;
          growth = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : 0;
        }
        return { year: d.label, revenue: currentRev, growthRate: parseFloat(growth.toFixed(2)) };
      });

      const responseData = {
        yearly: trends,
        monthly: monthlyData.map(d => ({ month: d.label, revenue: parseFloat(d.revenue) || 0 }))
      };

      cache.set(cacheKey, responseData);
      console.timeEnd(timerLabel);
      res.json(responseData);
    } catch (error) {
      console.error('historical-trends error:', error.message);
      res.status(500).json({ error: 'Failed to retrieve historical revenue trends' });
    }
  },

  // 2. Customer Revenue Shares (Top 10)
  getCustomerShares: async (req, res) => {
    try {
      const year = req.query.year || 'All';
      let cacheKey = `historical_customers_${year}`;
      if (req.user) {
        if (req.user.role === 'Party' && req.user.party_name) cacheKey += `_party_${req.user.party_name}`;
        else if (req.user.role === 'VCN' && req.user.vcn) cacheKey += `_vcn_${req.user.vcn}`;
      }
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);

      const timerLabel = `historical-customers-${year}-${Date.now()}`;
      console.time(timerLabel);

      const f1 = getYearFilter(req, true);
      const f2 = getYearFilter(req, false);

      // Run both queries in parallel
      const [topCustomers, sumResult] = await Promise.all([
        sequelize.query(
          `SELECT party_name as name, SUM(invoice_amount) as value FROM PortRecords WHERE party_name IS NOT NULL AND party_name != ""${f1.clause} GROUP BY party_name ORDER BY value DESC LIMIT 10`,
          { type: QueryTypes.SELECT, replacements: f1.replacements }
        ),
        sequelize.query(
          `SELECT SUM(invoice_amount) as total FROM PortRecords${f2.clause}`,
          { type: QueryTypes.SELECT, replacements: f2.replacements }
        )
      ]);

      const totalRevenue = parseFloat(sumResult[0].total) || 1.0;
      const formatted = topCustomers.map(c => {
        const val = parseFloat(c.value) || 0;
        return { name: c.name, value: val, percentage: parseFloat(((val / totalRevenue) * 100).toFixed(2)) };
      });

      cache.set(cacheKey, formatted);
      console.timeEnd(timerLabel);
      res.json(formatted);
    } catch (error) {
      console.error('historical-customers error:', error.message);
      res.status(500).json({ error: 'Failed to retrieve customer revenue shares' });
    }
  },

  // 3. Berth Traffic and Utilization
  getBerthTraffic: async (req, res) => {
    try {
      const year = req.query.year || 'All';
      let cacheKey = `historical_berths_${year}`;
      if (req.user) {
        if (req.user.role === 'Party' && req.user.party_name) cacheKey += `_party_${req.user.party_name}`;
        else if (req.user.role === 'VCN' && req.user.vcn) cacheKey += `_vcn_${req.user.vcn}`;
      }
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);

      const timerLabel = `historical-berths-${year}-${Date.now()}`;
      console.time(timerLabel);

      const f1 = getYearFilter(req, true);

      const berthData = await sequelize.query(
        `SELECT berth, SUM(invoice_amount) as revenue, COUNT(DISTINCT vcn) as vesselsCount, SUM(grt) as totalGRT FROM PortRecords WHERE berth IS NOT NULL AND berth != ""${f1.clause} GROUP BY berth ORDER BY revenue DESC`,
        { type: QueryTypes.SELECT, replacements: f1.replacements }
      );

      const formatted = berthData.map(b => ({
        berth: b.berth,
        revenue: parseFloat(b.revenue) || 0,
        vesselsCount: parseInt(b.vesselsCount) || 0,
        totalGRT: parseFloat(b.totalGRT) || 0
      }));

      cache.set(cacheKey, formatted);
      console.timeEnd(timerLabel);
      res.json(formatted);
    } catch (error) {
      console.error('historical-berths error:', error.message);
      res.status(500).json({ error: 'Failed to retrieve berth traffic' });
    }
  },

  // 4. Commodity Group distribution
  getCommodityDistribution: async (req, res) => {
    try {
      const year = req.query.year || 'All';
      let cacheKey = `historical_commodities_${year}`;
      if (req.user) {
        if (req.user.role === 'Party' && req.user.party_name) cacheKey += `_party_${req.user.party_name}`;
        else if (req.user.role === 'VCN' && req.user.vcn) cacheKey += `_vcn_${req.user.vcn}`;
      }
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);

      const timerLabel = `historical-commodities-${year}-${Date.now()}`;
      console.time(timerLabel);

      const f1 = getYearFilter(req, true);

      const query = `
        SELECT 
          CASE
            WHEN UPPER(TRIM(commodity_group)) = 'OTHER CARGO' THEN 'OTHER CARGO'
            WHEN UPPER(TRIM(commodity_group)) = 'PETROLEUM' THEN 'PETROLEUM'
            WHEN UPPER(TRIM(commodity_group)) IN ('GENERAL/OTHER', 'GENERAL / OTHER') THEN 'GENERAL/OTHER'
            WHEN UPPER(TRIM(commodity_group)) IN ('FERTILIZER RAW MATERIAL DRY', 'FERTILIZER RAWMATERIAL DRY') THEN 'FERTILIZER RAW MATERIAL DRY'
          END AS category,
          SUM(invoice_amount) AS revenue
        FROM PortRecords
        WHERE invoice_amount > 0
          AND UPPER(TRIM(commodity_group)) IN (
            'OTHER CARGO',
            'PETROLEUM',
            'GENERAL/OTHER',
            'GENERAL / OTHER',
            'FERTILIZER RAW MATERIAL DRY',
            'FERTILIZER RAWMATERIAL DRY'
          )
          ${f1.clause}
        GROUP BY category
        ORDER BY revenue DESC
      `;

      const commodityData = await sequelize.query(query, { type: QueryTypes.SELECT, replacements: f1.replacements });
      const formatted = commodityData.map(c => ({ name: c.category, value: parseFloat(c.revenue) || 0 }));

      cache.set(cacheKey, formatted);
      console.timeEnd(timerLabel);
      res.json(formatted);
    } catch (error) {
      console.error('historical-commodities error:', error.message);
      res.status(500).json({ error: 'Failed to retrieve commodity distribution' });
    }
  },

  // 5. Berth Gantt Timeline data
  getGanttData: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      let cacheKey = `historical_gantt_all`;
      if (startDate && endDate) cacheKey += `_range_${startDate}_${endDate}`;
      if (req.user) {
        if (req.user.role === 'Party' && req.user.party_name) cacheKey += `_party_${req.user.party_name}`;
        else if (req.user.role === 'VCN' && req.user.vcn) cacheKey += `_vcn_${req.user.vcn}`;
      }
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);

      const timerLabel = `historical-gantt-${Date.now()}`;
      console.time(timerLabel);

      const f1 = getYearFilter(req, true, '', true); // Always ignore global year filter for Gantt timeline

      let dateClause = '';
      const replacements = { ...f1.replacements };
      if (startDate && endDate) {
        dateClause = ` AND ata >= :startDate AND ata <= :endDate`;
        replacements.startDate = startDate;
        replacements.endDate = endDate;
      }

      const ganttData = await sequelize.query(
        `SELECT DISTINCT vcn, vessel_name as vesselName, berth, vessel_type as vesselType, grt, ata
        FROM PortRecords
        WHERE ata IS NOT NULL AND berth IS NOT NULL AND berth != "" AND vessel_name IS NOT NULL AND vessel_name != ""${f1.clause}${dateClause}
        ORDER BY ata DESC LIMIT 250`,
        { type: QueryTypes.SELECT, replacements }
      );

      const formatted = ganttData.map(v => {
        const arrival = new Date(v.ata);
        const grtVal = parseFloat(v.grt) || 10000;
        const durationDays = 1.0 + (grtVal / 50000.0);
        const departure = new Date(arrival.getTime() + durationDays * 24 * 60 * 60 * 1000);
        return {
          vcn: v.vcn,
          vesselName: v.vesselName,
          berth: v.berth,
          vesselType: v.vesselType || 'Other',
          grt: grtVal,
          ata: arrival.toISOString().split('T')[0],
          departure: departure.toISOString().split('T')[0]
        };
      });

      cache.set(cacheKey, formatted);
      console.timeEnd(timerLabel);
      res.json(formatted);
    } catch (error) {
      console.error('historical-gantt error:', error.message);
      res.status(500).json({ error: 'Failed to retrieve Gantt data' });
    }
  }
};

module.exports = historicalController;
