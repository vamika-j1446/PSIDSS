const dashboardController = require('../controllers/dashboardController');
const historicalController = require('../controllers/historicalController');
const strategicController = require('../controllers/strategicController');
const predictiveController = require('../controllers/predictiveController');
const recommendationController = require('../controllers/recommendationController');
const simulationController = require('../controllers/simulationController');

const years = ['Recent4', 'All'];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function warmup() {
  // Wait 1 second after server start for port to open
  await delay(1000);
  console.log('Starting PSIDSS cache warmup for default scopes...');

  const mockRes = {
    json: () => {},
    status: () => ({ json: () => {} })
  };

  // Fire warmup for both year scopes simultaneously
  await Promise.allSettled(years.map(async (year) => {
    const mockReq = { query: { year }, body: {} };

    // Within each year, fire ALL endpoints in parallel
    const results = await Promise.allSettled([
      dashboardController.getKPIs(mockReq, mockRes),
      historicalController.getRevenueTrends(mockReq, mockRes),
      historicalController.getCustomerShares(mockReq, mockRes),
      historicalController.getBerthTraffic(mockReq, mockRes),
      historicalController.getCommodityDistribution(mockReq, mockRes),
      historicalController.getGanttData(mockReq, mockRes),
      strategicController.getStrategicAnalysis(mockReq, mockRes),
      predictiveController.getForecasts(mockReq, mockRes),
      recommendationController.getRecommendations(mockReq, mockRes),
      simulationController.simulate(mockReq, mockRes),
    ]);

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`Warmup: ${failed.length} endpoint(s) failed for year=${year}`);
    } else {
      console.log(`Warmup: all endpoints cached for year=${year}`);
    }
  }));

  console.log('PSIDSS Cache warmup completed successfully! 🚀');
}

module.exports = warmup;
