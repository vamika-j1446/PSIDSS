const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PortRecord = sequelize.define('PortRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vcn: {
    type: DataTypes.STRING,
    allowNull: true
  },
  vessel_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  berth: {
    type: DataTypes.STRING,
    allowNull: true
  },
  grt: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0
  },
  commodity: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sor_commodity: {
    type: DataTypes.STRING,
    allowNull: true
  },
  account_code: {
    type: DataTypes.STRING,
    allowNull: true
  },
  charge_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  party_code: {
    type: DataTypes.STRING,
    allowNull: true
  },
  party_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  voyage_type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  invoice_no: {
    type: DataTypes.STRING,
    allowNull: true
  },
  invoice_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  invoice_datetime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  voyage_no: {
    type: DataTypes.STRING,
    allowNull: true
  },
  invoice_amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0
  },
  sor_amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0
  },
  discount_amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: true
  },
  unit_quantity1: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0
  },
  unit_quantity2: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0
  },
  unit_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0
  },
  exchange_rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 1.0
  },
  nature_of_ship: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ata: {
    type: DataTypes.DATE,
    allowNull: true
  },
  invoice_group: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sub_group: {
    type: DataTypes.STRING,
    allowNull: true
  },
  vessel_type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  commodity_group: {
    type: DataTypes.STRING,
    allowNull: true
  },
  source_year: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  reference_no: {
    type: DataTypes.STRING,
    allowNull: true
  },
  report_filename: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'PortRecords',
  indexes: [
    { fields: ['vcn'] },
    { fields: ['invoice_date'] },
    { fields: ['commodity_group'] },
    { fields: ['party_name'] },
    { fields: ['berth'] },
    { fields: ['commodity'] },
    { fields: ['source_year'] },
    { fields: ['report_filename'] }
  ]
});

module.exports = PortRecord;
