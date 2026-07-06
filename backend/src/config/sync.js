const { sequelize } = require('../models');
const authController = require('../controllers/authController');

console.log('Synchronizing database schema...');
sequelize.sync({ force: false }).then(async () => {
  console.log('Database schema synchronized successfully.');
  await authController.seedUsers();
  process.exit(0);
}).catch(err => {
  console.error('Database synchronization failed:', err);
  process.exit(1);
});
