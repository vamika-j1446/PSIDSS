const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const VcnPin = sequelize.define('VcnPin', {
  vcn: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  pin: {
    type: DataTypes.STRING(6),
    allowNull: false
  }
}, {
  tableName: 'VcnPins',
  timestamps: true
});

module.exports = VcnPin;
