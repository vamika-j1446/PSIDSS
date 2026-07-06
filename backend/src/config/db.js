const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

if (process.env.DB_TYPE === 'mysql') {
  console.log('Connecting to MySQL database...');
  sequelize = new Sequelize(
    process.env.DB_NAME || 'port_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || 'vamika@123',
    {
      host: process.env.DB_HOST || 'localhost',
      dialect: 'mysql',
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
} else {
  console.log('Connecting to SQLite database...');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './database.sqlite',
    logging: false
  });
}

module.exports = sequelize;
