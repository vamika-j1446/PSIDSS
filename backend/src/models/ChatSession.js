const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ChatSession = sequelize.define('ChatSession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    defaultValue: 'New Chat',
    allowNull: false
  }
}, {
  tableName: 'ChatSessions'
});

module.exports = ChatSession;
