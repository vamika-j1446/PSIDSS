const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const cache = require('../utils/cache');

const formatCurrencyMsg = (num) => {
  const absNum = Math.abs(num);
  if (absNum >= 1.0e9) return `₹${(num / 1.0e9).toFixed(2)} B`;
  if (absNum >= 1.0e7) return `₹${(num / 1.0e7).toFixed(2)} Cr`;
  if (absNum >= 1.0e5) return `₹${(num / 1.0e5).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const simulationController = {
  simulate: async (req, res) => {
    try {
      let selectedBerth = req.body.selectedBerth || req.query.berth || req.body.berth || 'All';
      if (selectedBerth === 'All Berths') {
        selectedBerth = 'All';
      }
      
      const yearScope = req.body.yearScope || req.query.year || req.body.year || 'All';
      const tariffPercent = req.body.tariffPercent !== undefined 
        ? parseFloat(req.body.tariffPercent) 
        : (req.query.tariffPercent !== undefined ? parseFloat(req.query.tariffPercent) : 10.0);

      // Cache the BASE database calculations (independent of tariffPercent)
      const baseCacheKey = `simulation_base_${yearScope}_${selectedBerth}`;
      let baseData = cache.get(baseCacheKey);

      if (!baseData) {
        const conditions = [];
        const replacements = {};

        if (yearScope && yearScope !== 'All' && yearScope !== 'All Fiscal Years' && yearScope !== 'all') {
          if (yearScope === 'Recent4') {
            conditions.push('source_year BETWEEN 2021 AND 2024');
          } else {
            const numYear = parseInt(yearScope, 10);
            if (!isNaN(numYear)) {
              conditions.push('source_year = :yearScope');
              replacements.yearScope = numYear;
            }
          }
        }

        if (selectedBerth && selectedBerth !== 'All' && selectedBerth !== 'all') {
          conditions.push('berth = :selectedBerth');
          replacements.selectedBerth = selectedBerth;
        }

        const roleConditions = [];
        if (req.user) {
          if (req.user.role === 'Party' && req.user.party_name) {
            roleConditions.push('party_name = :userPartyName');
            replacements.userPartyName = req.user.party_name;
          } else if (req.user.role === 'VCN' && req.user.vcn) {
            roleConditions.push('vcn = :userVcn');
            replacements.userVcn = req.user.vcn;
          }
        }

        const allConditions = [...conditions, ...roleConditions];
        const whereClause = allConditions.length ? `WHERE ${allConditions.join(' AND ')}` : '';

        // 1. Calculate base stats
        const statsResult = await sequelize.query(`
          SELECT 
            COALESCE(SUM(invoice_amount), 0) as baseRevenue,
            COUNT(*) as transactionCount,
            COUNT(DISTINCT vcn) as vesselCount,
            COUNT(DISTINCT party_name) as customerCount
          FROM PortRecords
          ${whereClause}
        `, { type: QueryTypes.SELECT, replacements });

        const baseRevenue = parseFloat(statsResult[0].baseRevenue) || 0;
        const transactionCount = parseInt(statsResult[0].transactionCount) || 0;
        const vesselCount = parseInt(statsResult[0].vesselCount) || 0;
        const customerCount = parseInt(statsResult[0].customerCount) || 0;

        // 2. Calculate total port revenue under same year scope
        const totalConditions = [];
        const totalReplacements = {};

        if (yearScope && yearScope !== 'All' && yearScope !== 'All Fiscal Years' && yearScope !== 'all') {
          if (yearScope === 'Recent4') {
            totalConditions.push('source_year BETWEEN 2021 AND 2024');
          } else {
            const numYear = parseInt(yearScope, 10);
            if (!isNaN(numYear)) {
              totalConditions.push('source_year = :yearScope');
              totalReplacements.yearScope = numYear;
            }
          }
        }

        const allTotalConditions = [...totalConditions, ...roleConditions];
        const totalWhereClause = allTotalConditions.length ? `WHERE ${allTotalConditions.join(' AND ')}` : '';

        const totalResult = await sequelize.query(`
          SELECT COALESCE(SUM(invoice_amount), 0) as totalPortRevenue
          FROM PortRecords
          ${totalWhereClause}
        `, { type: QueryTypes.SELECT, replacements: totalReplacements });

        const totalPortRevenue = parseFloat(totalResult[0].totalPortRevenue) || 1.0;

        // 3. Projection raw data
        const projConditions = [];
        const projReplacements = { ...replacements };

        if (selectedBerth && selectedBerth !== 'All' && selectedBerth !== 'all') {
          projConditions.push('berth = :selectedBerth');
          projReplacements.selectedBerth = selectedBerth;
        }
        projConditions.push('source_year IS NOT NULL AND source_year > 0');

        const allProjConditions = [...projConditions, ...roleConditions];
        const projWhereClause = allProjConditions.length ? `WHERE ${allProjConditions.join(' AND ')}` : '';

        const projResult = await sequelize.query(`
          SELECT 
            source_year AS year,
            COALESCE(SUM(invoice_amount), 0) AS historicalRevenue
          FROM PortRecords
          ${projWhereClause}
          GROUP BY source_year
          ORDER BY source_year ASC
        `, { type: QueryTypes.SELECT, replacements: projReplacements });

        // 4. Fetch distinct berths alphabetically
        const distinctBerthsResult = await sequelize.query(`
          SELECT DISTINCT berth
          FROM PortRecords
          WHERE berth IS NOT NULL AND berth != ""
          ORDER BY berth ASC
        `, { type: QueryTypes.SELECT });

        const berthsList = ['All Berths', ...distinctBerthsResult
          .map(r => r.berth ? r.berth.trim() : '')
          .filter(b => b !== '')
        ];

        baseData = {
          baseRevenue,
          transactionCount,
          vesselCount,
          customerCount,
          totalPortRevenue,
          projectionRaw: projResult,
          berthsList
        };

        cache.set(baseCacheKey, baseData);
      }

      // Destructure cached base calculations
      const {
        baseRevenue,
        transactionCount,
        vesselCount,
        customerCount,
        totalPortRevenue,
        projectionRaw,
        berthsList
      } = baseData;

      // 5. Compute simulated values dynamically using tariffPercent
      const simulatedRevenue = baseRevenue * (1 + tariffPercent / 100);
      const revenueDelta = simulatedRevenue - baseRevenue;
      const additionalNet = revenueDelta;
      const berthRevenueShare = totalPortRevenue > 0 ? (baseRevenue / totalPortRevenue) * 100 : 0;

      let title = 'Berth Tariff Impact';
      let impactLevel = 'Low financial impact';
      let message = 'Insufficient historical data to calculate risk for this berth';

      if (baseRevenue > 0) {
        if (selectedBerth === 'All') {
          title = 'Port-wide Tariff Impact';
          impactLevel = 'N/A';
          const sign = tariffPercent >= 0 ? '+' : '';
          message = `A ${sign}${tariffPercent}% tariff adjustment increases estimated revenue from ${formatCurrencyMsg(baseRevenue)} to ${formatCurrencyMsg(simulatedRevenue)}, creating ${formatCurrencyMsg(revenueDelta)} additional revenue. This is based on all selected historical billing records.`;
        } else {
          title = 'Berth Tariff Impact';
          if (berthRevenueShare >= 20) {
            impactLevel = 'High financial impact';
          } else if (berthRevenueShare >= 5) {
            impactLevel = 'Moderate financial impact';
          } else {
            impactLevel = 'Low financial impact';
          }
          const sign = tariffPercent >= 0 ? '+' : '';
          message = `This berth contributes ${berthRevenueShare.toFixed(2)}% of selected-scope revenue. A ${sign}${tariffPercent}% tariff adjustment creates ${formatCurrencyMsg(revenueDelta)} additional estimated revenue.`;
        }
      }

      const projection = projectionRaw.map(r => {
        const hist = parseFloat(r.historicalRevenue) || 0;
        return {
          year: parseInt(r.year) || 0,
          historicalRevenue: hist,
          simulatedRevenue: parseFloat((hist * (1 + tariffPercent / 100)).toFixed(2))
        };
      });

      const responseData = {
        baseRevenue,
        tariffPercent,
        simulatedRevenue,
        revenueDelta,
        additionalNet,
        selectedBerth: selectedBerth === 'All' ? 'All Berths' : selectedBerth,
        yearScope,
        diagnostics: {
          title,
          impactLevel,
          message,
          historicalRevenue: baseRevenue,
          simulatedRevenue,
          additionalRevenue: revenueDelta,
          revenueShare: parseFloat(berthRevenueShare.toFixed(2)),
          transactionCount,
          vesselCount,
          customerCount
        },
        projection,
        berths: berthsList
      };

      res.json(responseData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to run simulation' });
    }
  }
};

module.exports = simulationController;
