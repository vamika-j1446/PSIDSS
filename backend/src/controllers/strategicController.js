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

const serviceKeywordsExclusions = [
  'PILOTAGE', 'PORT DUES', 'TOWAGE', 'SHIFTING', 'BERTH HIRE', 'CREW CHANGE',
  'ANCHORAGE', 'FRESH WATER', 'WEIGHMENT', 'VCN CANCELLATION', 'LIFT-ON',
  'LIFT-OFF', 'WHARFAGE', 'STORAGE CHARGES', 'CARGO SPECIAL SERVICE',
  'CONTAINER STUFF DESTUFF', 'CFS CONTAINER', 'PILOTAGE CANCELLATION',
  'PILOTAGE DETENTION', 'COMPOSITE MARITIME CHARGES', 'SUNDRY VESSEL',
  'SUNDRY CARGO', 'RAMP EXAMINATION', 'COLD MOVEMENT', 'HANDLING',
  'SECURITY', 'GROUND RENT', 'DEMURRAGE', 'CFS STORAGE', 'COMPOSITE MARITIME',
  'MARINE SPECIAL SERVICE', 'BUFFER YARD', 'REEFER', 'INVOICE', 'CHARGE', 'CHARGES'
];

const parseSourceYear = (yearVal) => {
  if (yearVal === null || yearVal === undefined) return null;
  const str = String(yearVal).trim();
  if (!str) return null;
  const match = str.match(/\b\d{4}\b/);
  if (match) {
    return parseInt(match[0], 10);
  }
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? null : parsed;
};

const normalizeCommodityName = (commodity) => {
  if (!commodity) return 'UNKNOWN';
  const c = String(commodity).toUpperCase().trim();

  // A. Crude Oil
  if (c.includes('CRUDE') || c.includes('SPMCRM') || c.includes('SPMCRO') || c.includes('SPMCRA') || c.includes('CROTH')) {
    return 'CRUDE OIL';
  }
  // B. Diesel / HSD
  if (c.includes('HSD') || c.includes('DIESEL HIGH SPEED') || c.includes('STS HIGH SPPED DIESEL')) {
    return 'HSD / DIESEL';
  }
  // C. Motor Spirit
  if (c.includes('MS-MOTOR SPIRIT') || c.includes('MOTOR SPIRIT')) {
    return 'MOTOR SPIRIT';
  }
  // D. Fuel / Furnace Oil
  if (c.includes('FO-OIL FURNACE OIL') || c.includes('FUO-FUEL OIL') || c.includes('FUEL OIL') || c.includes('FURNACE OIL') || c === 'FO') {
    return 'FUEL / FURNACE OIL';
  }
  // E. Naphtha
  if (c.includes('NAPHTHA') || c.includes('LAN-NAFTHA')) {
    return 'NAPHTHA';
  }
  // F. Aviation Fuel
  if (c.includes('ATF') || c.includes('AVIATION TURBO FUEL') || c.includes('JET PETROL') || c.includes('JP-JET PETROL')) {
    return 'AVIATION FUEL';
  }
  // G. LPG
  if (c.includes('LPG') || c.includes('BUTANE') || c.includes('PROPANE')) {
    return 'LPG';
  }
  // H. Carbon Black Feed Stock
  if (c.includes('CBFS') || c.includes('CARBON BLACK FEED STOCK')) {
    return 'CARBON BLACK FEED STOCK';
  }
  // I. Fertilizer raw materials
  if (c.includes('PHOSPHORIC')) {
    return 'PHOSPHORIC ACID';
  }
  if (c.includes('SULPHURIC')) {
    return 'SULPHURIC ACID';
  }
  if (c.includes('SULPHUR')) {
    return 'SULPHUR';
  }
  if (c.includes('ROCK PHOSPHATE')) {
    return 'ROCK PHOSPHATE';
  }

  // J. General cargo items & Clean fallback
  if (c.includes('LIQUID AMMONIA') || c.includes('LA-LIQUID') || c.includes('LA-LIQUID AMMONIA')) {
    return 'LIQUID AMMONIA';
  }
  if (c.includes('ETHYLINE DICHLORIDE') || c.includes('EDC-')) {
    return 'ETHYLENE DICHLORIDE';
  }
  if (c.includes('ILMINITE SAND') || c.includes('ILMNT-')) {
    return 'ILMENITE SAND';
  }
  if (c.includes('SUNFLOWER') || c.includes('SUNFWR-')) {
    return 'SUNFLOWER OIL';
  }
  if (c.includes('SPICES') || c.includes('SPI-')) {
    return 'SPICES';
  }
  if (c.includes('FOOD PRODUCTS') || c.includes('FDR-')) {
    return 'FOOD PRODUCTS';
  }
  if (c.includes('TIMBER LOGS') || c.includes('LOGS-')) {
    return 'TIMBER LOGS';
  }
  if (c.includes('ALUMINA') || c.includes('ALUMNA')) {
    return 'ALUMINA';
  }
  if (c.includes('SALT')) {
    return 'SALT';
  }
  if (c.includes('CLINKER') || c.includes('CLIN')) {
    return 'CLINKER';
  }
  if (c.includes('CEMENT') || c.includes('CMG')) {
    return 'CEMENT';
  }
  if (c.includes('METHANOL') || c.includes('MNOL')) {
    return 'METHANOL';
  }
  if (c.includes('PROJECT CARGO') || c.includes('PROJCT')) {
    return 'PROJECT CARGO';
  }
  if (c.includes('DEFENCE CARGO') || c.includes('DC-')) {
    return 'DEFENCE CARGO';
  }
  if (c.includes('METALS') || c.includes('MMPS')) {
    return 'METALS';
  }

  // Fallback: humanize the name
  return commodity
    .split(/[-_ ]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

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

      console.time("strategic-api");
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

      // 2. Commodity Growth Sectors
      let latestYear = 2024;
      let prevYear = 2016;

      if (year && year !== 'All' && year !== 'All Fiscal Years' && year !== 'all') {
        if (year === 'Recent4') {
          latestYear = 2024;
          prevYear = 2021;
        } else {
          const numYear = parseInt(year, 10);
          if (!isNaN(numYear)) {
            latestYear = numYear;
            prevYear = numYear - 1;
            if (prevYear < 2016) prevYear = 2016;
          }
        }
      }

      const commodityGrowth = [];
      let scopeClause = '';
      const replacements = {};
      if (req.user) {
        if (req.user.role === 'Party' && req.user.party_name) {
          scopeClause = ' AND party_name = :userPartyName';
          replacements.userPartyName = req.user.party_name;
        } else if (req.user.role === 'VCN' && req.user.vcn) {
          scopeClause = ' AND vcn = :userVcn';
          replacements.userVcn = req.user.vcn;
        }
      }

      const replacementsWithYears = {
        ...replacements,
        prevYear,
        latestYear
      };

      const commodityRevenues = await sequelize.query(`
        SELECT 
          commodity_group,
          commodity,
          source_year,
          SUM(invoice_amount) as revenue
        FROM PortRecords
        WHERE commodity IS NOT NULL 
          AND commodity != ""
          AND source_year IN (:prevYear, :latestYear)${scopeClause}
        GROUP BY commodity_group, commodity, source_year
      `, { type: QueryTypes.SELECT, replacements: replacementsWithYears });

      const pivot = {};
      const groupPivot = {};

      commodityRevenues.forEach(row => {
        const rawCommodity = row.commodity;
        const rawGroup = row.commodity_group;
        const rowYear = parseSourceYear(row.source_year);

        // Exclude null years and years outside comparison bounds
        if (rowYear === null || (rowYear !== latestYear && rowYear !== prevYear)) {
          return;
        }

        // Exclude service keywords/charges
        const upperComm = String(rawCommodity).toUpperCase().trim();
        if (serviceKeywordsExclusions.some(keyword => upperComm.includes(keyword))) {
          return;
        }

        // Determine groupName
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

        // Normalize commodity name
        const name = normalizeCommodityName(rawCommodity);

        // Group level pivot
        if (!groupPivot[groupName]) {
          groupPivot[groupName] = { latest: 0, prev: 0 };
        }
        if (rowYear === latestYear) {
          groupPivot[groupName].latest += parseFloat(row.revenue) || 0;
        } else if (rowYear === prevYear) {
          groupPivot[groupName].prev += parseFloat(row.revenue) || 0;
        }

        // Granular level pivot
        if (!pivot[name]) {
          pivot[name] = { latest: 0, prev: 0, group: groupName };
        }
        if (rowYear === latestYear) {
          pivot[name].latest += parseFloat(row.revenue) || 0;
        } else if (rowYear === prevYear) {
          pivot[name].prev += parseFloat(row.revenue) || 0;
        }
      });

      Object.keys(pivot).forEach(name => {
        const latestRev = pivot[name].latest;
        const prevRev = pivot[name].prev;
        const group = pivot[name].group;

        // Apply threshold: startRevenue >= 1,000,000 OR endRevenue >= 1,000,000
        if (prevRev < 1000000 && latestRev < 1000000) {
          return;
        }

        let growth = 0;
        let isNew = false;
        if (prevRev > 0) {
          growth = ((latestRev - prevRev) / prevRev) * 100;
        } else if (latestRev > 0) {
          isNew = true;
          growth = 100.0;
        }

        commodityGrowth.push({
          name: name,
          group: group,
          latestRevenue: latestRev,
          previousRevenue: prevRev,
          growthRate: parseFloat(growth.toFixed(2)),
          isNew: isNew
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
        level: concentrationStatus,
        category: 'Revenue Concentration',
        message: `Top customer revenue share is ${topCustomerShare.toFixed(2)}% and Top 5 customer revenue share is ${top5CustomerShare.toFixed(2)}%.`,
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
        level: customerStatus,
        category: 'Customer Performance',
        message: `Top growing customer is '${topGrower}' (+${formatCurrency(topGrowerDiff)}) and highest declining customer is '${topDecliner}' (${topDeclinerDiff < 0 ? '-' : ''}${formatCurrency(Math.abs(topDeclinerDiff))}).`,
        meaning: 'Shows whether the customer base is expanding or contracting.',
        reason: `Top growing customer is '${topGrower}' (+${formatCurrency(topGrowerDiff)}) and highest declining customer is '${topDecliner}' (${topDeclinerDiff < 0 ? '-' : ''}${formatCurrency(Math.abs(topDeclinerDiff))}).`,
        action: 'Review customers with sharp revenue decline and plan follow-up actions.'
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
        level: berthStatus,
        category: 'Berth Performance',
        message: `Top performing berth is '${topBerthName}' (${formatCurrency(topBerthRevenue)} across ${topBerthTransactions} transactions). Lowest performing berth is '${lowestBerthName}' (${formatCurrency(lowestBerthRevenue)} across ${lowestBerthTransactions} transactions).`,
        meaning: 'Shows which berths contribute most and least to port revenue.',
        reason: `Top performing berth is '${topBerthName}' (${formatCurrency(topBerthRevenue)} across ${topBerthTransactions} transactions). Lowest performing berth is '${lowestBerthName}' (${formatCurrency(lowestBerthRevenue)} across ${lowestBerthTransactions} transactions).`,
        action: 'Continue monitoring berth-wise revenue share.'
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
        level: growthStatus,
        category: 'Revenue Trend',
        message: `Overall Revenue Growth is ${overallGrowth.toFixed(2)}% with a CAGR of ${cagr.toFixed(2)}%. Highest growth FY is ${fastestYear} (+${fastestGrowth.toFixed(1)}% YoY) and lowest growth FY is ${slowestYear} (${slowestGrowth >= 0 ? '+' : ''}${slowestGrowth.toFixed(1)}% YoY).`,
        meaning: 'Summarise long-term financial performance.',
        reason: `Overall Revenue Growth is ${overallGrowth.toFixed(2)}% with a CAGR of ${cagr.toFixed(2)}%. Highest growth FY is ${fastestYear} (+${fastestGrowth.toFixed(1)}% YoY) and lowest growth FY is ${slowestYear} (${slowestGrowth >= 0 ? '+' : ''}${slowestGrowth.toFixed(1)}% YoY).`,
        action: 'Monitor forecast changes monthly and compare with actual revenue.'
      });

      // Card 5: Commodity Decline
      const hasDecline = commodityGrowth.some(c => c.growthRate < 0);
      const commodityDeclineStatus = hasDecline ? 'High' : 'No Risk';
      risks.push({
        title: 'Commodity Decline',
        risk: 'Commodity Decline',
        name: 'Commodity Decline',
        status: commodityDeclineStatus,
        level: commodityDeclineStatus,
        category: 'Commodity Decline',
        message: commodityDeclineStatus === 'High' ? 'One or more commodities show negative growth rate.' : 'All major commodities are stable or growing.',
        meaning: 'Shows whether major cargo groups are contracting in revenue.',
        reason: commodityDeclineStatus === 'High' ? 'One or more commodities show negative growth rate.' : 'All major commodities are stable or growing.',
        action: 'Track declining commodities and compare with commodity group performance.'
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
      console.timeEnd("strategic-api");
      res.json(responseData);
    } catch (error) {
      console.timeEnd("strategic-api");
      console.error(error);
      res.status(500).json({ error: 'Failed to retrieve strategic analysis data' });
    }
  }
};

module.exports = strategicController;
