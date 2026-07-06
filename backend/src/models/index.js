const sequelize = require('../config/db');
const User = require('./User');
const UploadedFile = require('./UploadedFile');
const PortRecord = require('./PortRecord');
const Forecast = require('./Forecast');
const PartyPin = require('./PartyPin');
const VcnPin = require('./VcnPin');
const ChatSession = require('./ChatSession');
const ChatMessage = require('./ChatMessage');

// Establish associations
UploadedFile.hasMany(PortRecord, {
  foreignKey: 'report_filename',
  sourceKey: 'filename',
  onDelete: 'CASCADE'
});

PortRecord.belongsTo(UploadedFile, {
  foreignKey: 'report_filename',
  targetKey: 'filename',
  onDelete: 'CASCADE'
});

ChatSession.hasMany(ChatMessage, {
  foreignKey: 'session_id',
  onDelete: 'CASCADE'
});

ChatMessage.belongsTo(ChatSession, {
  foreignKey: 'session_id',
  onDelete: 'CASCADE'
});

module.exports = {
  sequelize,
  User,
  UploadedFile,
  PortRecord,
  Forecast,
  PartyPin,
  VcnPin,
  ChatSession,
  ChatMessage
};
