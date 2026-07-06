const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UploadedFile = sequelize.define('UploadedFile', {
  filename: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  upload_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  record_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  file_size: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'UploadedFiles'
});

module.exports = UploadedFile;
