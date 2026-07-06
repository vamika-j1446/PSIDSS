const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Forecast = sequelize.define('Forecast', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.ENUM('revenue', 'commodity', 'customer', 'berth'),
    allowNull: false
  },
  target_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  horizon: {
    type: DataTypes.ENUM('month', 'quarter', 'year'),
    allowNull: false
  },
  forecast_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  forecast_value: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  growth_percentage: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0
  },
  confidence_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0.0
  }
}, {
  tableName: 'Forecasts',
  indexes: [
    { fields: ['type', 'target_name'] },
    { fields: ['horizon'] }
  ]
});

module.exports = Forecast;
