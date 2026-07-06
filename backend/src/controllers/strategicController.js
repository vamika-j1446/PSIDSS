const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const cache = require('../utils/cache');
const { getYearFilter } = require('../utils/filter');

const commodityNamesMap = {
  'HSD-DIESEL HIGH SPEED': 'High Speed Diesel',
  'SPMCRM-SPM CRUDE MIDDLE EAST': 'Crude Oil (Middle East)',
  'MS-MOTOR SPIRIT': 'Motor Spirit',
  'SPMCRO-SPM CRUDE OTHERS': 'Crude Oil (Others)',
  'CMG-CEMENT': 'Cement',
  'FO-OIL FURNACE OIL': 'Furnace Oil',
  'LAN-NAFTHA LOW AREATED': 'Naphtha',
  'RP-ROCK PHOSPHATE': 'Rock Phosphate',
  'CROTH-CRUDES OTHERS': 'Crude Oil (Other)',
  'PHAD-PHOSPHORIC ACID': 'Phosphoric Acid',
  'MNOL-METHANOL': 'Methanol',
  'CBFS-OIL CARBON BLACK FEED STOCK': 'Carbon Black Feed Stock',
  'SULAD-SULPHURIC ACID': 'Sulphuric Acid',
  'SPMCRA-SPM CRUDE AFRICA': 'Crude Oil (Africa)',
  'CLIN-CLINKER IN BULK': 'Clinker',
  'S-SULPHUR': 'Sulphur',
  'SALT-SALT IN BULK': 'Salt',
  'EDC-ETHYLINE DICHLORIDE': 'Ethylene Dichloride',
  'LA-LIQUID AMMONIA': 'Liquid Ammonia',
  'ILMNT-ILMINITE SAND': 'Ilmenite Sand',
  'SUNFWR-SUNFLOWER OIL': 'Sunflower Oil',
  'MMPS-METALS & METAL PRODUCTS': 'Metals & Metal Products',
  'ALUMNA-ALUMINA IN JUMBO BAGS': 'Alumina',
  'ATF-AVIATION TURBO FUEL': 'Aviation Turbine Fuel',
  'FUO-FUEL OIL': 'Fuel Oil',
  'FO': 'Furnace Oil',
  'SYNT-SYNTHETIC RUTILE': 'Synthetic Rutile',
  'DC-DEFENCE CARGO': 'Defence Cargo',
  'PROJCT-PROJECT CARGO': 'Project Cargo',
  'MOTOR SPIRIT': 'Motor Spirit',
  'TIMBER LOGS': 'Timber Logs',
  'JET PETROL': 'Jet Petrol',
  'STSHSD-STS HIGH SPPED DIESEL': 'High Speed Diesel (STS)',
  'BENZ-BENZENE': 'Benzene',
  'LPGB1-LPG BUTANE @ Rs.1': 'LPG Butane',
  'LPGP1-LPG PROPANE @ Rs.1': 'LPG Propane',
  'ALUMNAJ-Aluminium Hydroxide in jumbo bags': 'Aluminium Hydroxide',
  'SPI-OTHER SPICES': 'Spices',
  'PLUTYS-PLUSH TOYS': 'Plush Toys',
  'EXPLVP-EXPLOSIVES - NON CONTAINERIZED': 'Explosives',
  'GARM-GARMENTS': 'Garments',
  'CHPLS-CHAPPALS': 'Chappals',
  'FDR-FOOD PRODUCTS': 'Food Products',
  'LOGS-TIMBER LOGS': 'Timber Logs',
  'JP-JET PETROL': 'Jet Petrol',
  'BBOTHERS-ANY ITEM OTHER THAN SPECIFIED': 'Other Cargo',
  'BOAT-TRAWLERS & OTHER FISHING VESSL': 'Trawlers & Fishing Vessels',
  'YACHT-SAIL BOAT/ YACHT': 'Sail Boats & Yachts'
};

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

const formatCurrency = (num) => {
  const absNum = Math.abs(num);
  if (absNum >= 1.0e7) return `₹${(num / 1.0e7).toFixed(2)} Cr`;
  if (absNum >= 1.0e5) return `₹${(num / 1.0e5).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const strategicController = {
  getStrategicAnalysis: async (req, res) => {
    try {
      const year = req.query.year || 'All';
      const cacheKey = `strategic_analysis_${year}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const f1 = getYearFilter(req, true); // hasWhereAlready = true
      const f2 = getYearFilter(req, false); // hasWhereAlready = false

      // 1. Client Concentration Ratio & HHI
      const customerRevenues = await sequelize.query(`
        SELECT party_name, SUM(invoice_amount) as revenue
        FROM PortRecords
        WHERE party_name IS NOT NULL AND party_name != ""${f1.clause}
        GROUP BY party_name
        ORDER BY revenue DESC
      `, { type: QueryTypes.SELECT, replacements: f1.replacements });

      const totalRevenueResult = await sequelize.query(`
        SELECT SUM(invoice_amount) as total FROM PortRecords${f2.clause}
      `, { type: QueryTypes.SELECT, replacements: f2.replacements });
      const totalRevenue = parseFloat(totalRevenueResult[0].total) || 1.0;

      let hhi = 0;
      let topCustomerShare = 0;
      let top5CustomerShare = 0;
      const shares = [];

      customerRevenues.forEach((c, idx) => {
        const rev = parseFloat(c.revenue) || 0;
        const share = (rev / totalRevenue) * 100;
        shares.push({
          name: c.party_name,
          revenue: rev,
          share: parseFloat(share.toFixed(2))
        });

        hhi += share * share;
        if (idx === 0) topCustomerShare = share;
        if (idx < 5) top5CustomerShare += share;
      });

      // 2. Commodity Growth Sectors (Calculated on resolved whitelist comparing FY24-25 vs FY16-17)
      const latestYear = 2024;
      const prevYear = 2016;
      const prevYearExists = true;

      const commodityGrowth = [];
      let scopeClause = '';
      const replacements = { latestYear, prevYear };
      if (req.user) {
        if (req.user.role === 'Party' && req.user.party_name) {
          scopeClause = ' AND party_name = :userPartyName';
          replacements.userPartyName = req.user.party_name;
        } else if (req.user.role === 'VCN' && req.user.vcn) {
          scopeClause = ' AND vcn = :userVcn';
          replacements.userVcn = req.user.vcn;
        }
      }

      const commodityRevenues = await sequelize.query(`
        SELECT 
          commodity_group,
          commodity,
          source_year,
          SUM(invoice_amount) as revenue
        FROM PortRecords
        WHERE source_year IN (:latestYear, :prevYear) 
          AND commodity IS NOT NULL 
          AND commodity != ""${scopeClause}
        GROUP BY commodity_group, commodity, source_year
      `, { type: QueryTypes.SELECT, replacements });

      // Pivot and Map display names using whitelist
      const pivot = {};
      const groupPivot = {};

      commodityRevenues.forEach(row => {
        const rawCommodity = row.commodity;
        const rawGroup = row.commodity_group;
        
        let groupName = 'Other Cargo';
        if (rawGroup) {
          const rgUpper = rawGroup.toUpperCase().trim();
          if (rgUpper === 'PETROLEUM') {
            groupName = 'Petroleum';
          } else if (rgUpper === 'FERTILIZER RAW MATERIAL DRY') {
            groupName = 'Fertilizers';
          } else if (rgUpper === 'OTHER CARGO') {
            groupName = 'Other Cargo';
          }
        }

        const upperComm = rawCommodity.toUpperCase();
        if (!serviceKeywords.some(keyword => upperComm.includes(keyword))) {
          if (!groupPivot[groupName]) {
            groupPivot[groupName] = { latest: 0, prev: 0 };
          }
          if (row.source_year === latestYear) {
            groupPivot[groupName].latest += parseFloat(row.revenue) || 0;
          } else if (row.source_year === prevYear) {
            groupPivot[groupName].prev += parseFloat(row.revenue) || 0;
          }
        }

        let name = commodityNamesMap[rawCommodity];
        if (!name) {
          if (serviceKeywords.some(keyword => upperComm.includes(keyword))) {
            return;
          }
          // Humanize raw commodity code
          name = rawCommodity
            .toLowerCase()
            .split(/[-_ ]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }

        if (!pivot[name]) {
          pivot[name] = { latest: 0, prev: 0, group: groupName };
        }

        if (row.source_year === latestYear) {
          pivot[name].latest += parseFloat(row.revenue) || 0;
        } else if (row.source_year === prevYear) {
          pivot[name].prev += parseFloat(row.revenue) || 0;
        }
      });

      Object.keys(pivot).forEach(name => {
        const latestRev = pivot[name].latest;
        const prevRev = pivot[name].prev;
        const group = pivot[name].group;

        // Apply threshold: first_year_revenue >= 1,000,000 AND total_revenue_across_all_years >= 5,000,000
        const totalAcross = latestRev + prevRev;
        if (prevRev < 1000000 || totalAcross < 5000000) {
          return;
        }

        let growth = 0;
        if (prevRev > 0) {
          growth = ((latestRev - prevRev) / prevRev) * 100;
        } else if (latestRev > 0) {
          growth = 100.0;
        }
        commodityGrowth.push({
          name: name,
          group: group,
          latestRevenue: latestRev,
          previousRevenue: prevRev,
          growthRate: parseFloat(growth.toFixed(2))
        });
      });

      const groupGrowth = [];
      Object.keys(groupPivot).forEach(name => {
        const latestRev = groupPivot[name].latest;
        const prevRev = groupPivot[name].prev;

        let growth = 0;
        if (prevRev > 0) {
          growth = ((latestRev - prevRev) / prevRev) * 100;
        } else if (latestRev > 0) {
          growth = 100.0;
        }
        groupGrowth.push({
          name: name,
          latestRevenue: latestRev,
          previousRevenue: prevRev,
          growthRate: parseFloat(growth.toFixed(2))
        });
      });

      // 3. Executive Business Insights
      const risks = [];

      // Card 1: Revenue Concentration
      let concentrationStatus = 'Low';
      let concentrationAction = 'Continue current carrier support packages and maintain service standards.';

      if (topCustomerShare > 45) {
        concentrationStatus = 'High';
        concentrationAction = 'Attract additional customers and shippers to reduce carrier concentration and dependency.';
      } else if (topCustomerShare > 25) {
        concentrationStatus = 'Medium';
        concentrationAction = 'Attract additional customers and shippers to reduce carrier concentration and dependency.';
      }

      risks.push({
        title: 'Revenue Concentration',
        risk: 'Revenue Concentration',
        name: 'Revenue Concentration',
        status: concentrationStatus,
        meaning: 'Indicates how dependent the port is on a few major customers.',
        reason: `Top customer revenue share is ${topCustomerShare.toFixed(2)}% and Top 5 customer revenue share is ${top5CustomerShare.toFixed(2)}%.`,
        action: concentrationAction
      });

      // Card 2: Customer Performance
      const customerCompare = await sequelize.query(`
        SELECT party_name, source_year, SUM(invoice_amount) as revenue
        FROM PortRecords
        WHERE source_year IN (2016, 2024) AND party_name IS NOT NULL AND party_name != ""
        GROUP BY party_name, source_year
      `, { type: QueryTypes.SELECT });

      const custPivot = {};
      customerCompare.forEach(row => {
        const { party_name, source_year, revenue } = row;
        if (!custPivot[party_name]) {
          custPivot[party_name] = { latest: 0, prev: 0 };
        }
        if (source_year === 2024) {
          custPivot[party_name].latest = parseFloat(revenue) || 0;
        } else if (source_year === 2016) {
          custPivot[party_name].prev = parseFloat(revenue) || 0;
        }
      });

      const custGrowth = [];
      Object.keys(custPivot).forEach(name => {
        const latest = custPivot[name].latest;
        const prev = custPivot[name].prev;
        if (prev >= 1000000 || latest >= 1000000) {
          custGrowth.push({
            name,
            latest,
            prev,
            diff: latest - prev
          });
        }
      });

      let topGrower = 'N/A';
      let topGrowerDiff = 0;
      let topDecliner = 'N/A';
      let topDeclinerDiff = 0;

      if (custGrowth.length > 0) {
        custGrowth.sort((a, b) => b.diff - a.diff);
        const grower = custGrowth[0];
        if (grower && grower.diff > 0) {
          topGrower = grower.name;
          topGrowerDiff = grower.diff;
        }

        const decliner = custGrowth[custGrowth.length - 1];
        if (decliner && decliner.diff < 0) {
          topDecliner = decliner.name;
          topDeclinerDiff = decliner.diff;
        }
      }

      let customerStatus = 'Low';
      if (Math.abs(topDeclinerDiff) > 10000000) {
        customerStatus = 'Medium';
      }

      risks.push({
        title: 'Customer Performance',
        risk: 'Customer Performance',
        name: 'Customer Performance',
        status: customerStatus,
        meaning: 'Shows whether the customer base is expanding or contracting.',
        reason: `Top growing customer is '${topGrower}' (+${formatCurrency(topGrowerDiff)}) and highest declining customer is '${topDecliner}' (${topDeclinerDiff < 0 ? '-' : ''}${formatCurrency(Math.abs(topDeclinerDiff))}).`,
        action: 'Retain declining customers and strengthen relationships with growing customers.'
      });

      // Card 3: Berth Performance
      const berthTraffic = await sequelize.query(`
        SELECT berth, SUM(invoice_amount) as revenue, COUNT(*) as transactions
        FROM PortRecords
        WHERE berth IS NOT NULL AND berth != ""${f1.clause}
        GROUP BY berth
        ORDER BY revenue DESC
      `, { type: QueryTypes.SELECT, replacements: f1.replacements });

      let topBerthName = 'N/A';
      let topBerthRevenue = 0;
      let topBerthTransactions = 0;
      let lowestBerthName = 'N/A';
      let lowestBerthRevenue = 0;
      let lowestBerthTransactions = 0;
      let berthStatus = 'Low';

      if (berthTraffic.length > 0) {
        const topB = berthTraffic[0];
        topBerthName = topB.berth;
        topBerthRevenue = parseFloat(topB.revenue) || 0;
        topBerthTransactions = parseInt(topB.transactions) || 0;

        const lowB = berthTraffic[berthTraffic.length - 1];
        lowestBerthName = lowB.berth;
        lowestBerthRevenue = parseFloat(lowB.revenue) || 0;
        lowestBerthTransactions = parseInt(lowB.transactions) || 0;

        const topBerthRevenueShare = (topBerthRevenue / totalRevenue) * 100;
        if (topBerthRevenueShare > 40) {
          berthStatus = 'Medium';
        }
      }

      risks.push({
        title: 'Berth Performance',
        risk: 'Berth Performance',
        name: 'Berth Performance',
        status: berthStatus,
        meaning: 'Shows which berths contribute most and least to port revenue.',
        reason: `Top performing berth is '${topBerthName}' (${formatCurrency(topBerthRevenue)} across ${topBerthTransactions} transactions). Lowest performing berth is '${lowestBerthName}' (${formatCurrency(lowestBerthRevenue)} across ${lowestBerthTransactions} transactions).`,
        action: 'Review utilisation of low-performing berths and continue supporting high-performing berths.'
      });

      // Card 4: Revenue Trend
      const yearlyTotals = await sequelize.query(`
        SELECT source_year as year, SUM(invoice_amount) as revenue
        FROM PortRecords
        WHERE source_year IS NOT NULL AND source_year >= 2016 AND source_year <= 2024
        GROUP BY source_year
        ORDER BY source_year ASC
      `, { type: QueryTypes.SELECT });

      let cagr = 0;
      let overallGrowth = 0;
      let fastestYear = 'N/A';
      let fastestGrowth = -999999;
      let slowestYear = 'N/A';
      let slowestGrowth = 999999;

      if (yearlyTotals.length >= 2) {
        const firstRow = yearlyTotals[0];
        const lastRow = yearlyTotals[yearlyTotals.length - 1];
        const firstRev = parseFloat(firstRow.revenue) || 1.0;
        const lastRev = parseFloat(lastRow.revenue) || 0.0;
        
        const nYears = lastRow.year - firstRow.year;
        if (nYears > 0) {
          cagr = (Math.pow(lastRev / firstRev, 1 / nYears) - 1) * 100;
        }
        overallGrowth = ((lastRev - firstRev) / firstRev) * 100;

        for (let i = 1; i < yearlyTotals.length; i++) {
          const prev = parseFloat(yearlyTotals[i-1].revenue) || 1.0;
          const curr = parseFloat(yearlyTotals[i].revenue) || 0.0;
          const yoy = ((curr - prev) / prev) * 100;
          const yrName = `FY${String(yearlyTotals[i].year).slice(2)}–${String(yearlyTotals[i].year + 1).slice(2)}`;
          if (yoy > fastestGrowth) {
            fastestGrowth = yoy;
            fastestYear = yrName;
          }
          if (yoy < slowestGrowth) {
            slowestGrowth = yoy;
            slowestYear = yrName;
          }
        }
      }

      let growthStatus = 'Low';
      if (cagr > 10) {
        growthStatus = 'High';
      } else if (cagr > 5) {
        growthStatus = 'Medium';
      }

      risks.push({
        title: 'Revenue Trend',
        risk: 'Revenue Trend',
        name: 'Revenue Trend',
        status: growthStatus,
        meaning: 'Summarise long-term financial performance.',
        reason: `Overall Revenue Growth is ${overallGrowth.toFixed(2)}% with a CAGR of ${cagr.toFixed(2)}%. Highest growth FY is ${fastestYear} (+${fastestGrowth.toFixed(1)}% YoY) and lowest growth FY is ${slowestYear} (${slowestGrowth >= 0 ? '+' : ''}${slowestGrowth.toFixed(1)}% YoY).`,
        action: 'Maintain growth momentum while investigating years with lower growth.'
      });

      const responseData = {
        concentration: {
          hhi: parseFloat(hhi.toFixed(2)),
          top1Share: parseFloat(topCustomerShare.toFixed(2)),
          top5Share: parseFloat(top5CustomerShare.toFixed(2)),
          topCustomers: shares.slice(0, 5)
        },
        risks,
        commodityGrowth: commodityGrowth.sort((a, b) => b.growthRate - a.growthRate),
        groupGrowth: groupGrowth.sort((a, b) => b.growthRate - a.growthRate)
      };

      cache.set(cacheKey, responseData);
      res.json(responseData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to retrieve strategic analysis data' });
    }
  }
};

module.exports = strategicController;
