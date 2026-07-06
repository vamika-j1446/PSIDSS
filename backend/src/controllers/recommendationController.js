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
      const cacheKey = `recommendations_v2_${yearScope}`;
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
          ${whereClause}
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
            impact: 'High Impact',
            title: 'Re-engage declining high-value customer',
            evidence: `${c.party_name} revenue decreased from ${formatCurrencyMsg(prevRevenueVal)} in FY${prevYr} to ${formatCurrencyMsg(latestRevenueVal)} in FY${latestYr}, a decline of ${declineVal.toFixed(1)}%.`,
            action: 'Schedule customer review, identify causes for reduced billing volume, and offer customized volume-based discounts.',
            benefit: 'Protects recurring revenue and improves high-value customer retention.',
            metrics: {
              previousRevenue: prevRevenueVal,
              latestRevenue: latestRevenueVal,
              declinePercent: parseFloat(declineVal.toFixed(2))
            }
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
            ${whereClause}
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
            impact: 'Medium Impact',
            title: 'Strengthen high-performing revenue categories',
            evidence: `Category '${topCategory.name}' is the top revenue group, contributing ${formatCurrencyMsg(topCategory.latestRev)} representing ${topCategoryShare.toFixed(2)}% of total selected-scope revenue in FY${latestYr}.`,
            action: `Promote high-margin handling agreements for '${topCategory.name}' and align dedicated warehousing to retain volume contracts.`,
            benefit: 'Secures and anchors the port\'s core cargo cargo volume segments.',
            metrics: {
              revenue: topCategory.latestRev,
              share: parseFloat(topCategoryShare.toFixed(2))
            }
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
        const cagr = ((latestR.revenue / firstR.revenue) ** (1 / (yearlyRevenues.length - 1)) - 1) * 100;
        const YoY_latest = ((latestR.revenue - prevR.revenue) / prevR.revenue) * 100;

        if (yearlyRevenues.length >= 3) {
          const prevPrevR = yearlyRevenues[yearlyRevenues.length - 3];
          const YoY_prev = ((prevR.revenue - prevPrevR.revenue) / prevPrevR.revenue) * 100;
          if (YoY_latest < YoY_prev) {
            recommendations.push({
              id: 'revenue-growth-slowing',
              category: 'Revenue Growth',
              impact: 'High Impact',
              title: 'Investigate slowing revenue growth',
              evidence: `Latest YoY growth slowed to ${YoY_latest.toFixed(2)}% compared to ${YoY_prev.toFixed(2)}% in the previous period.`,
              action: 'Review declining customers, commodities, and berths to identify billing leakages or volume drops.',
              benefit: 'Identifies leakage areas early to restore historical growth rates.'
            });
          } else {
            recommendations.push({
              id: 'revenue-growth-momentum',
              category: 'Revenue Growth',
              impact: 'Medium Impact',
              title: 'Maintain revenue growth momentum',
              evidence: `Revenue increased from ${formatCurrencyMsg(firstR.revenue)} in FY${firstR.year} to ${formatCurrencyMsg(latestR.revenue)} in FY${latestR.year}, achieving a CAGR of ${cagr.toFixed(2)}%.`,
              action: 'Focus business development on the highest-growing revenue categories, berths, and customers.',
              benefit: 'Maintains long-term compounding revenue growth and port market share.'
            });
          }
        } else {
          recommendations.push({
            id: 'revenue-growth-momentum',
            category: 'Revenue Growth',
            impact: 'Medium Impact',
            title: 'Maintain revenue growth momentum',
            evidence: `Revenue increased from ${formatCurrencyMsg(firstR.revenue)} in FY${firstR.year} to ${formatCurrencyMsg(latestR.revenue)} in FY${latestR.year}, achieving YoY growth of ${YoY_latest.toFixed(2)}%.`,
            action: 'Focus business development on the highest-growing revenue categories, berths, and customers.',
            benefit: 'Maintains long-term compounding revenue growth and port market share.'
          });
        }
      }

      // 2. Customer Concentration
      if (customerRevenues.length > 0) {
        const top1 = parseFloat(customerRevenues[0].revenue);
        const top5 = customerRevenues.slice(0, 5).reduce((sum, c) => sum + parseFloat(c.revenue), 0);
        const top1Share = (top1 / totalRevenue) * 100;
        const top5Share = (top5 / totalRevenue) * 100;

        if (top1Share > 25 || top5Share > 60) {
          recommendations.push({
            id: 'customer-concentration-high',
            category: 'Customer Risk',
            impact: 'High Impact',
            title: 'Reduce customer concentration risk',
            evidence: `The top customer contributes ${top1Share.toFixed(2)}% and the top 5 customers contribute ${top5Share.toFixed(2)}% of total selected-scope revenue.`,
            action: 'Actively market port services to secondary and mid-tier liners to diversify carrier risk.',
            benefit: 'Reduces structural dependency on a small cohort of major customers.'
          });
        } else if (top5Share >= 40 && top5Share <= 60) {
          recommendations.push({
            id: 'customer-concentration-medium',
            category: 'Customer Risk',
            impact: 'Medium Impact',
            title: 'Monitor customer concentration',
            evidence: `The top 5 customers contribute ${top5Share.toFixed(2)}% of total selected-scope revenue, indicating moderate revenue concentration.`,
            action: 'Offer volume incentives for mid-size operators to expand their share.',
            benefit: 'Protects port revenue stability against single-carrier disruption.'
          });
        } else {
          recommendations.push({
            id: 'customer-concentration-low',
            category: 'Customer Risk',
            impact: 'Low Impact',
            title: 'Customer base is reasonably diversified',
            evidence: `The top 5 customers represent only ${top5Share.toFixed(2)}% of total selected-scope revenue.`,
            action: 'Continue standard relationship management with top carriers.',
            benefit: 'Low concentration risk ensures stable revenue flows.'
          });
        }
      }

      // 3. Customer Retention
      if (retentionCard) {
        recommendations.push(retentionCard);
      }

      // 4. High Value Customer
      if (customerRevenues.length > 0) {
        const topCust = customerRevenues[0];
        const topShare = (parseFloat(topCust.revenue) / totalRevenue) * 100;
        recommendations.push({
          id: 'high-value-customer-protect',
          category: 'Opportunities',
          impact: 'High Impact',
          title: 'Protect high-value customer relationships',
          evidence: `Top customer ${topCust.party_name} contributed ${formatCurrencyMsg(topCust.revenue)}, representing ${topShare.toFixed(2)}% of total selected-scope revenue.`,
          action: 'Prioritize key account management, negotiate long-term MVC contracts, and guarantee premium berth service levels.',
          benefit: "Secures stable core revenue and prevents attrition of the port's primary customer."
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
            impact: 'Medium Impact',
            title: 'Optimize berth revenue performance',
            evidence: `Berth ${highestBerth.berth} contributes ${highestShare.toFixed(2)}% of total selected-scope revenue, whereas active Berth ${lowestBerth.berth} contributes only ${lowestShare.toFixed(2)}%.`,
            action: `Review cargo allocation policies, optimize logistics flows, and identify dedicated customer opportunities for underperforming Berth ${lowestBerth.berth}.`,
            benefit: 'Improves berth utilization balance and unlocks additional capacity across terminals.'
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
