const sequelize = require('../config/db');

const getQueryScope = (req, hasWhereAlready = false, tableAlias = '', ignoreYear = false) => {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const year = req.query.year;
  let clause = '';
  const replacements = {};

  // 1. Year Filter
  if (!ignoreYear && year) {
    if (year === 'Recent4') {
      const cond = `${prefix}source_year BETWEEN 2021 AND 2024`;
      clause += hasWhereAlready ? ` AND ${cond}` : ` WHERE ${cond}`;
      hasWhereAlready = true;
    } else if (year !== 'All' && year !== 'all') {
      const cond = `${prefix}source_year = :yearFilter`;
      clause += hasWhereAlready ? ` AND ${cond}` : ` WHERE ${cond}`;
      hasWhereAlready = true;
      replacements.yearFilter = parseInt(year, 10);
    }
  }

  // 2. User Portal Scope (Party Name or VCN)
  if (req.user) {
    if (req.user.role === 'Party' && req.user.party_name) {
      const cond = `${prefix}party_name = :userPartyName`;
      clause += hasWhereAlready ? ` AND ${cond}` : ` WHERE ${cond}`;
      hasWhereAlready = true;
      replacements.userPartyName = req.user.party_name;
    } else if (req.user.role === 'VCN' && req.user.vcn) {
      const cond = `${prefix}vcn = :userVcn`;
      clause += hasWhereAlready ? ` AND ${cond}` : ` WHERE ${cond}`;
      hasWhereAlready = true;
      replacements.userVcn = req.user.vcn;
    }
  }

  return { clause, replacements };
};

const getYearFilter = (req, hasWhereAlready = true, tableAlias = '', ignoreYear = false) => {
  return getQueryScope(req, hasWhereAlready, tableAlias, ignoreYear);
};

module.exports = { 
  getQueryScope,
  getYearFilter 
};
