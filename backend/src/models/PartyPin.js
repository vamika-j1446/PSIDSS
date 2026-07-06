const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PartyPin = sequelize.define('PartyPin', {
  party_name: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  pin: {
    type: DataTypes.STRING(6),
    allowNull: false
  }
}, {
  tableName: 'PartyPins',
  timestamps: true
});

module.exports = PartyPin;
