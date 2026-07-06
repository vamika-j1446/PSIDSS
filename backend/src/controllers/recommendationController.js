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

const recommendationController = {
  getRecommendations: async (req, res) => {
    try {
      const yearScope = req.query.year || 'All';
      const cacheKey = `recommendations_v3_${yearScope}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

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

      // 1. Calculate yearly revenues for growth metrics
      const yearlyRevenues = await sequelize.query(`
        SELECT 
          source_year AS year,
          SUM(invoice_amount) AS revenue
        FROM PortRecords
        ${whereClause}
        GROUP BY source_year
        ORDER BY source_year ASC
      `, { type: QueryTypes.SELECT, replacements });

      // 2. Customer shares
      const customerRevenues = await sequelize.query(`
        SELECT party_name, SUM(invoice_amount) as revenue
        FROM PortRecords
        ${whereClause}
        GROUP BY party_name
        ORDER BY revenue DESC
      `, { type: QueryTypes.SELECT, replacements });

      const totalRevenue = customerRevenues.reduce((sum, c) => sum + parseFloat(c.revenue), 0) || 1.0;

      // 3. Berth revenues
      const berthRevenues = await sequelize.query(`
        SELECT berth, SUM(invoice_amount) as revenue
        FROM PortRecords
        ${whereClause}
        GROUP BY berth
        ORDER BY revenue DESC
      `, { type: QueryTypes.SELECT, replacements });

      // Find the latest two years in this year scope for customer comparisons
      const yearsInScope = yearlyRevenues.map(r => r.year);
      let prevYr = null;
      let latestYr = null;
      if (yearsInScope.length >= 2) {
        latestYr = yearsInScope[yearsInScope.length - 1];
        prevYr = yearsInScope[yearsInScope.length - 2];
      }

      // Customer retention comparison
      let retentionCard = null;
      if (latestYr && prevYr) {
        const custComparison = await sequelize.query(`
          SELECT 
            party_name,
            SUM(CASE WHEN source_year = :prevYr THEN invoice_amount ELSE 0 END) as prevRev,
            SUM(CASE WHEN source_year = :latestYr THEN invoice_amount ELSE 0 END) as latestRev
          FROM PortRecords
          ${whereClause ? `${whereClause} AND source_year IN (:prevYr, :latestYr)` : 'WHERE source_year IN (:prevYr, :latestYr)'}
          GROUP BY party_name
          HAVING prevRev >= 5000000 AND ((prevRev - latestRev) / prevRev) > 0.3
          ORDER BY (prevRev - latestRev) DESC
          LIMIT 1
        `, { type: QueryTypes.SELECT, replacements: { ...replacements, prevYr, latestYr } });

        if (custComparison.length > 0) {
          const c = custComparison[0];
          const prevRevenueVal = parseFloat(c.prevRev);
          const latestRevenueVal = parseFloat(c.latestRev);
          const declineVal = ((prevRevenueVal - latestRevenueVal) / prevRevenueVal) * 100;
          retentionCard = {
            id: `customer-retention-${c.party_name}`,
            category: 'Retention',
            impact: 'HIGH IMPACT',
            title: 'Re-engage declining high-value customer',
            shortProblem: 'Some billing partners show YoY revenue contraction.',
            evidence: `${c.party_name}: ${formatCurrencyMsg(prevRevenueVal)} → ${formatCurrencyMsg(latestRevenueVal)} (-${declineVal.toFixed(0)}%)`,
            action: 'Review reasons for reduced billing and plan follow-up.',
            benefit: 'Protects recurring customer revenue.',
            explanation: `Automated audit indicates customer ${c.party_name} had a significant drop of ${declineVal.toFixed(1)}% YoY in billing value. Retention planning is advised.`
          };
        }
      }

      // Commodity category advisory
      let commodityCard = null;
      if (latestYr && prevYr) {
        const excludedKeywords = [
          'Pilotage', 'Anchorage', 'Berth Hire', 'Port Dues', 'Towage', 'Fresh Water', 
          'Shifting', 'Crew Change', 'Cold Movement', 'Security', 'VCN Cancellation', 
          'Composite', 'Special Services', 'Lift-On', 'Ramp', 'Weighment', 'Buffer', 
          'Stuff', 'Storage', 'Ground Rent', 'Baggage', 'Sundry', 'Wharfage', 
          'Demurrage', 'Invoice', 'Charges', 'Crane'
        ];
        
        const commodityCondition = excludedKeywords.map((kw, i) => `
          c.name NOT LIKE :exclude_${i}
        `).join(' AND ');

        const excludeReplacements = {};
        excludedKeywords.forEach((kw, i) => {
          excludeReplacements[`exclude_${i}`] = `%${kw}%`;
        });

        const commRevenues = await sequelize.query(`
          SELECT 
            c.name,
            SUM(c.latest) as latestRev,
            SUM(c.prev) as prevRev
          FROM (
            SELECT 
              COALESCE(NULLIF(commodity_group, ''), commodity) as name,
              SUM(CASE WHEN source_year = :latestYr THEN invoice_amount ELSE 0 END) as latest,
              SUM(CASE WHEN source_year = :prevYr THEN invoice_amount ELSE 0 END) as prev
            FROM PortRecords
            ${whereClause ? `${whereClause} AND source_year IN (:prevYr, :latestYr)` : 'WHERE source_year IN (:prevYr, :latestYr)'}
            GROUP BY name
          ) as c
          WHERE c.name IS NOT NULL AND c.name != "" AND ${commodityCondition}
          GROUP BY c.name
        `, { type: QueryTypes.SELECT, replacements: { ...replacements, prevYr, latestYr, ...excludeReplacements } });

        if (commRevenues.length > 0) {
          commRevenues.sort((a, b) => b.latestRev - a.latestRev);
          const topCategory = commRevenues[0];
          const topCategoryShare = (topCategory.latestRev / totalRevenue) * 100;

          commodityCard = {
            id: `commodity-advisory-${topCategory.name}`,
            category: 'Commodity / Cargo',
            impact: 'MEDIUM IMPACT',
            title: 'Strengthen high-performing revenue categories',
            shortProblem: 'Core commodity segments represent majority billing concentration.',
            evidence: `${topCategory.name} is the top revenue group (${topCategoryShare.toFixed(1)}% of selected revenue).`,
            action: 'Monitor high-performing commodity groups and track declining categories.',
            benefit: 'Supports core cargo revenue planning.',
            explanation: `The commodity group '${topCategory.name}' stands out as the primary billing driver. Ongoing categorization helps manage tariff volatility.`
          };
        }
      }

      // Build advisory list
      const recommendations = [];

      // 1. Revenue Growth
      if (yearlyRevenues.length >= 2) {
        const firstR = yearlyRevenues[0];
        const latestR = yearlyRevenues[yearlyRevenues.length - 1];
        const prevR = yearlyRevenues[yearlyRevenues.length - 2];
        const YoY_latest = ((latestR.revenue - prevR.revenue) / prevR.revenue) * 100;

        if (yearlyRevenues.length >= 3) {
          const prevPrevR = yearlyRevenues[yearlyRevenues.length - 3];
          const YoY_prev = ((prevR.revenue - prevPrevR.revenue) / prevPrevR.revenue) * 100;
          if (YoY_latest < YoY_prev) {
            recommendations.push({
              id: 'revenue-growth-slowing',
              category: 'Revenue Growth',
              impact: 'HIGH IMPACT',
              title: 'Investigate slowing revenue growth',
              shortProblem: 'YoY growth rate has contracted compared to the previous period.',
              evidence: `YoY growth slowed: ${YoY_prev.toFixed(2)}% → ${YoY_latest.toFixed(2)}%`,
              action: 'Review customers, commodity groups, and berths with declining revenue.',
              benefit: 'Helps restore stronger growth.',
              explanation: `Regression indicators flag that latest YoY growth (${YoY_latest.toFixed(1)}%) is lower than previous period (${YoY_prev.toFixed(1)}%). Volatility review is recommended.`
            });
          } else {
            recommendations.push({
              id: 'revenue-growth-momentum',
              category: 'Revenue Growth',
              impact: 'MEDIUM IMPACT',
              title: 'Maintain revenue growth momentum',
              shortProblem: 'Port billing trend indicates active positive expansion.',
              evidence: `YoY growth: ${YoY_latest.toFixed(2)}%`,
              action: 'Review customers, commodity groups, and berths with declining revenue.',
              benefit: 'Helps restore stronger growth.',
              explanation: `Billing logs verify positive revenue momentum. Focus on maintaining operational billing performance.`
            });
          }
        } else {
          recommendations.push({
            id: 'revenue-growth-momentum',
            category: 'Revenue Growth',
            impact: 'MEDIUM IMPACT',
            title: 'Maintain revenue growth momentum',
            shortProblem: 'Port billing trend indicates active positive expansion.',
            evidence: `YoY growth: ${YoY_latest.toFixed(2)}%`,
            action: 'Review customers, commodity groups, and berths with declining revenue.',
            benefit: 'Helps restore stronger growth.',
            explanation: `Billing logs verify positive revenue momentum. Focus on maintaining operational billing performance.`
          });
        }
      }

      // 2. Customer Concentration (Customer Risk)
      if (customerRevenues.length > 0) {
        const top5 = customerRevenues.slice(0, 5).reduce((sum, c) => sum + parseFloat(c.revenue), 0);
        const top5Share = (top5 / totalRevenue) * 100;

        if (top5Share > 40) {
          recommendations.push({
            id: 'customer-concentration-high',
            category: 'Customer Risk',
            impact: 'HIGH IMPACT',
            title: 'Monitor customer concentration',
            shortProblem: 'The top 5 customers represent a large share of overall billing.',
            evidence: `Top 5 customers share: ${top5Share.toFixed(1)}% of selected revenue`,
            action: 'Monitor top customer dependency and maintain engagement with key accounts.',
            benefit: 'Reduces risk from single-customer revenue loss.',
            explanation: `Billing concentration HHI diagnostics reveal dependency on a small cohort of major customers.`
          });
        } else {
          recommendations.push({
            id: 'customer-concentration-low',
            category: 'Customer Risk',
            impact: 'LOW IMPACT',
            title: 'Customer base is reasonably diversified',
            shortProblem: 'Port billing is well diversified across shipping lines.',
            evidence: `Top 5 customers represent only ${top5Share.toFixed(1)}% of total selected-scope revenue.`,
            action: 'Monitor top customer dependency and maintain engagement with key accounts.',
            benefit: 'Reduces risk from single-customer revenue loss.',
            explanation: `Diversification index indicates low carrier concentration risk for this selected period.`
          });
        }
      }

      // 3. Customer Retention
      if (retentionCard) {
        recommendations.push(retentionCard);
      }

      // 4. High Value Customer (Opportunities)
      if (customerRevenues.length > 0) {
        const topCust = customerRevenues[0];
        const topShare = (parseFloat(topCust.revenue) / totalRevenue) * 100;
        recommendations.push({
          id: 'high-value-customer-protect',
          category: 'Opportunities',
          impact: 'HIGH IMPACT',
          title: 'Protect high-value customer relationships',
          shortProblem: 'Highest billing contributor represents a core percentage of earnings.',
          evidence: `Top customer share: ${topShare.toFixed(1)}% of selected revenue`,
          action: 'Protect high-value customer relationships and monitor revenue share.',
          benefit: 'Supports stable core revenue.',
          explanation: `Billing audit identifies ${topCust.party_name} as the primary port client. Strategic relationship management is critical.`
        });
      }

      // 5. Berth Performance
      if (berthRevenues.length >= 2) {
        const highestBerth = berthRevenues[0];
        const meaningfulBerths = berthRevenues.filter(b => b.revenue > 1000000);
        if (meaningfulBerths.length >= 2) {
          const lowestBerth = meaningfulBerths[meaningfulBerths.length - 1];
          const highestShare = (highestBerth.revenue / totalRevenue) * 100;
          const lowestShare = (lowestBerth.revenue / totalRevenue) * 100;

          recommendations.push({
            id: 'berth-performance-optimize',
            category: 'Berth Performance',
            impact: 'MEDIUM IMPACT',
            title: 'Review low-revenue berth contribution',
            shortProblem: 'Significant revenue imbalance detected across terminal berths.',
            evidence: `Top berth: ${highestBerth.berth} (${highestShare.toFixed(1)}%), low berth: ${lowestBerth.berth} (${lowestShare.toFixed(1)}%)`,
            action: 'Compare low-revenue berths with high-revenue berths and review billing contribution.',
            benefit: 'Improves berth-wise revenue visibility.',
            explanation: `Berth utilization metrics indicate substantial differences in billing contribution. Benchmarking provides operational baseline.`
          });
        }
      }

      // 6. Commodity
      if (commodityCard) {
        recommendations.push(commodityCard);
      }

      cache.set(cacheKey, recommendations);
      res.json(recommendations);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to generate recommendations' });
    }
  }
};

module.exports = recommendationController;
