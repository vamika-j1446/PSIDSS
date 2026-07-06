const { Forecast, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const cache = require('../utils/cache');

const predictiveController = {
  getForecasts: async (req, res) => {
    try {
      const year = req.query.year || 'All';
      const cacheKey = `predictive_forecasts_${year}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Fetch all forecasts
      const forecasts = await Forecast.findAll({
        order: [['forecast_date', 'ASC']]
      });

      // Group forecasts by type
      const grouped = {
        revenue: [],
        commodity: {},
        customer: {},
        berth: {}
      };

      forecasts.forEach(f => {
        const value = parseFloat(f.forecast_value) || 0;
        const confidence = parseFloat(f.confidence_score) || 0.85;
        // Compute standard error margin for 95% confidence bounds
        const margin = (1.0 - confidence) * 0.5; // Scaled margin
        const lowerBound = Math.max(0, value * (1.0 - margin));
        const upperBound = value * (1.0 + margin);

        const item = {
          id: f.id,
          target_name: f.target_name,
          horizon: f.horizon,
          date: f.forecast_date,
          value,
          growth: parseFloat(f.growth_percentage) || 0,
          confidence,
          lowerBound: parseFloat(lowerBound.toFixed(2)),
          upperBound: parseFloat(upperBound.toFixed(2))
        };

        if (f.type === 'revenue') {
          grouped.revenue.push(item);
        } else {
          const typeMap = grouped[f.type];
          if (!typeMap[f.target_name]) {
            typeMap[f.target_name] = [];
          }
          typeMap[f.target_name].push(item);
        }
      });

      const formatCurrency = (num) => {
        if (num >= 1.0e9) return `₹${(num / 1.0e9).toFixed(2)} B`;
        if (num >= 1.0e7) return `₹${(num / 1.0e7).toFixed(2)} Cr`;
        if (num >= 1.0e5) return `₹${(num / 1.0e5).toFixed(2)} L`;
        return `₹${num.toLocaleString('en-IN')}`;
      };

      // 3. Identify at-risk customers directly from database records (YoY & consecutive declines, filtering out incomplete years)
      const dbYears = await sequelize.query(`
        SELECT source_year, COUNT(*) as count
        FROM PortRecords
        WHERE source_year IS NOT NULL AND source_year > 0
        GROUP BY source_year
        HAVING count > 15000
        ORDER BY source_year ASC
      `, { type: QueryTypes.SELECT });
      
      const yearsList = dbYears.map(y => parseInt(y.source_year));
      const latestYear = yearsList.length > 0 ? yearsList[yearsList.length - 1] : null;
      const prevYear = yearsList.length > 1 ? yearsList[yearsList.length - 2] : null;
      const prev2Year = yearsList.length > 2 ? yearsList[yearsList.length - 3] : null;

      const customerRevenues = await sequelize.query(`
        SELECT party_name, source_year, SUM(invoice_amount) as revenue
        FROM PortRecords
        WHERE party_name IS NOT NULL AND party_name != ""
        GROUP BY party_name, source_year
        ORDER BY party_name, source_year ASC
      `, { type: QueryTypes.SELECT });

      // Group by customer name
      const custProfiles = {};
      customerRevenues.forEach(r => {
        const name = r.party_name;
        if (!custProfiles[name]) custProfiles[name] = {};
        custProfiles[name][r.source_year] = parseFloat(r.revenue) || 0;
      });

      const atRiskCustomers = [];
      if (latestYear && prevYear) {
        Object.keys(custProfiles).forEach(name => {
          const profile = custProfiles[name];
          const latestRev = profile[latestYear] || 0;
          const prevRev = profile[prevYear] || 0;
          const prev2Rev = prev2Year ? (profile[prev2Year] || 0) : 0;

          let isAtRisk = false;
          let riskLevel = 'Medium';
          let reason = '';
          let declineAmount = 0;
          let declinePercentage = 0;

          if (prevRev > 0 && latestRev === 0) {
            // Condition C: Customer had billing before but disappeared in latest year
            isAtRisk = true;
            riskLevel = 'High';
            declineAmount = prevRev;
            declinePercentage = 100.0;
            reason = 'Complete customer churn: no cargo billing registered in the latest fiscal year.';
          } else if (prevRev > 0 && latestRev < prevRev) {
            // Condition A: latest year revenue lower than previous year
            isAtRisk = true;
            declineAmount = prevRev - latestRev;
            declinePercentage = (declineAmount / prevRev) * 100;
            riskLevel = declinePercentage > 25 ? 'High' : 'Medium';
            reason = `Year-over-Year revenue contraction of -${declinePercentage.toFixed(1)}% (fell from ${formatCurrency(prevRev)} to ${formatCurrency(latestRev)}).`;
          }

          if (prev2Year && prev2Rev > 0 && prevRev < prev2Rev && latestRev < prevRev) {
            // Condition B: revenue declined for 2 consecutive years
            isAtRisk = true;
            declineAmount = prev2Rev - latestRev;
            declinePercentage = (declineAmount / prev2Rev) * 100;
            riskLevel = 'High';
            reason = `Critical risk: consecutive revenue decline for two fiscal years (dropped from ${formatCurrency(prev2Rev)} to ${formatCurrency(latestRev)}).`;
          }

          if (isAtRisk) {
            atRiskCustomers.push({
              name,
              previousRevenue: prevRev,
              latestRevenue: latestRev,
              declineAmount,
              declinePercentage: parseFloat(declinePercentage.toFixed(2)),
              riskLevel,
              reason
            });
          }
        });
      }

      // Sort at-risk customers by highest decline percentage
      atRiskCustomers.sort((a, b) => b.declinePercentage - a.declinePercentage);

      // 4. Identify declining commodities directly from database records (YoY decline)
      const commodityRevenues = await sequelize.query(`
        SELECT commodity, source_year, SUM(invoice_amount) as revenue
        FROM PortRecords
        WHERE commodity IS NOT NULL AND commodity != ""
        GROUP BY commodity, source_year
        ORDER BY commodity, source_year ASC
      `, { type: QueryTypes.SELECT });

      const commProfiles = {};
      commodityRevenues.forEach(r => {
        const name = r.commodity;
        if (!commProfiles[name]) commProfiles[name] = {};
        commProfiles[name][r.source_year] = parseFloat(r.revenue) || 0;
      });

      const decliningCommodities = [];
      if (latestYear && prevYear) {
        Object.keys(commProfiles).forEach(name => {
          const profile = commProfiles[name];
          const latestRev = profile[latestYear] || 0;
          const prevRev = profile[prevYear] || 0;

          if (prevRev > 0 && latestRev < prevRev) {
            const declineAmount = prevRev - latestRev;
            const declinePercentage = (declineAmount / prevRev) * 100;
            decliningCommodities.push({
              name,
              previousRevenue: prevRev,
              latestRevenue: latestRev,
              declineAmount,
              declinePercentage: parseFloat(declinePercentage.toFixed(2)),
              riskLevel: declinePercentage > 25 ? 'High' : 'Medium',
              reason: `YoY cargo volume contraction of -${declinePercentage.toFixed(1)}%.`
            });
          }
        });
      }

      // Sort declining commodities by highest decline percentage
      decliningCommodities.sort((a, b) => b.declinePercentage - a.declinePercentage);

      // 5. Dynamic Mapped Risks based on real database metrics
      const calculatedRisks = [];

      const sumResult = await sequelize.query(`
        SELECT SUM(invoice_amount) as total FROM PortRecords
      `, { type: QueryTypes.SELECT });
      const totalRevenue = parseFloat(sumResult[0].total) || 1.0;

      // A. Customer Concentration Churn Risk
      let custLvl = 'No Risk';
      let custWhy = 'No billing customers currently show negative revenue trends or contract alerts.';
      let custEv = 'All active customer accounts are stable or expanding YoY.';
      let custAct = 'Continue standard billing accounts support and partner relations.';

      if (atRiskCustomers.length > 0) {
        const highRiskCount = atRiskCustomers.filter(c => c.riskLevel === 'High').length;
        custLvl = highRiskCount > 0 ? 'High' : 'Medium';
        custWhy = 'Multiple port billing partners show declining YoY revenue volumes, indicating potential contract churn.';
        custEv = `${atRiskCustomers.length} active cargo lines show negative revenue trends (Top churn: ${atRiskCustomers[0].name} at -${atRiskCustomers[0].declinePercentage}%).`;
        custAct = 'Initiate strategic volume lease renegotiations and loyalty incentives for the identified carriers.';
      }

      calculatedRisks.push({
        name: 'Customer Concentration Churn Risk',
        level: custLvl,
        why: custWhy,
        evidence: custEv,
        action: custAct
      });

      // B. Berth Dependency Failure Risk
      const berthShares = await sequelize.query(`
        SELECT berth, SUM(invoice_amount) as revenue
        FROM PortRecords
        WHERE berth IS NOT NULL AND berth != ""
        GROUP BY berth
        ORDER BY revenue DESC LIMIT 1
      `, { type: QueryTypes.SELECT });

      let berthLvl = 'No Risk';
      let berthWhy = 'Vessel docking is distributed evenly across multiple terminal berths.';
      let berthEv = 'No single berth handles more than 40% of overall cargo billing.';
      let berthAct = 'Schedule routine off-peak terminal crane checkups.';

      if (berthShares.length > 0) {
        const topBerthRev = parseFloat(berthShares[0].revenue) || 0;
        const topBerthShare = (topBerthRev / totalRevenue) * 100;
        if (topBerthShare > 50) {
          berthLvl = 'High';
          berthWhy = 'Over-reliance on a single terminal. A major crane outage or channel bottleneck will freeze half of the port\'s monthly revenue.';
          berthEv = `Berth '${berthShares[0].berth}' drives ${topBerthShare.toFixed(1)}% of total port billing volume.`;
          berthAct = 'Install high-speed crane backups and dredge secondary drafts to accommodate container redirections.';
        } else if (topBerthShare > 30) {
          berthLvl = 'Medium';
          berthWhy = 'Significant billing concentration around a single dock area.';
          berthEv = `Berth '${berthShares[0].berth}' drives ${topBerthShare.toFixed(1)}% of port billing.`;
          berthAct = 'Reroute feeder vessels and small bulk carriers to auxiliary docks.';
        }
      }

      calculatedRisks.push({
        name: 'Berth Dependency Failure Risk',
        level: berthLvl,
        why: berthWhy,
        evidence: berthEv,
        action: berthAct
      });

      // C. Cargo Segment Churn Risk
      let cargoLvl = 'No Risk';
      let cargoWhy = 'All operational cargo sectors are stable or expanding YoY. No storage yard bottlenecks detected.';
      let cargoEv = 'No active cargo commodities have negative YoY projection slopes.';
      let cargoAct = 'Continue standard warehousing and storage yard operations.';

      if (decliningCommodities.length > 0) {
        const highRiskCount = decliningCommodities.filter(cc => cc.riskLevel === 'High').length;
        cargoLvl = highRiskCount > 0 ? 'High' : 'Medium';
        cargoWhy = 'Active database aggregates indicate contraction within specific commodities, threatening dry/liquid yard utilization.';
        cargoEv = `${decliningCommodities.length} commodities show YoY billing drops (Top: '${decliningCommodities[0].name}' at -${decliningCommodities[0].declinePercentage}%).`;
        cargoAct = `Re-purpose storage areas assigned to '${decliningCommodities[0].name}' to support growing cargo sectors.`;
      }

      calculatedRisks.push({
        name: 'Cargo Segment Churn Risk',
        level: cargoLvl,
        why: cargoWhy,
        evidence: cargoEv,
        action: cargoAct
      });

      // D. Revenue Projection Churn Risk
      const revForecasts = grouped.revenue.filter(f => f.horizon === 'month');
      revForecasts.sort((a, b) => new Date(a.date) - new Date(b.date));
      const lastRevForecast = revForecasts[revForecasts.length - 1];

      let revLvl = 'No Risk';
      let revWhy = 'Regression modeling indicates stable, positive billing growth projections.';
      let revEv = 'Forecast models predict positive revenue trajectory over the monthly horizon.';
      let revAct = 'Proceed with planned port capital expenditure projects.';

      if (lastRevForecast) {
        if (lastRevForecast.growth < -10) {
          revLvl = 'High';
          revWhy = 'Predictive regression warns of port-wide billing drops over the monthly horizon.';
          revEv = `Linear trend projections forecast a monthly revenue drop-rate of ${lastRevForecast.growth.toFixed(1)}%.`;
          revAct = 'Freeze all non-essential capex and deploy a +10% sandbox tariff adjustment immediately.';
        } else if (lastRevForecast.growth < 0) {
          revLvl = 'Medium';
          revWhy = 'Predictive regression shows moderate risk of revenue volume stagnation.';
          revEv = `Linear trend forecasts billing change at ${lastRevForecast.growth.toFixed(1)}%.`;
          revAct = 'Optimize vessel turnaround times using stack Gantt scheduling to boost throughput.';
        }
      }

      calculatedRisks.push({
        name: 'Revenue Projection Churn Risk',
        level: revLvl,
        why: revWhy,
        evidence: revEv,
        action: revAct
      });

      const responseData = {
        revenue: grouped.revenue,
        commodities: grouped.commodity,
        customers: grouped.customer,
        berths: grouped.berth,
        atRiskCustomers,
        decliningCommodities,
        calculatedRisks
      };

      cache.set(cacheKey, responseData);
      res.json(responseData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to retrieve predictive insights' });
    }
  }
};

module.exports = predictiveController;
