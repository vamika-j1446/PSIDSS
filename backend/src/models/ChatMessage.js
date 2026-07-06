const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('user', 'assistant', 'system'),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  source: {
    type: DataTypes.ENUM('dictionary', 'database', 'system', 'ai'),
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('dictionary', 'data_answer', 'explanation', 'chat_control', 'unsupported'),
    allowNull: true
  }
}, {
  tableName: 'ChatMessages'
});

module.exports = ChatMessage;
