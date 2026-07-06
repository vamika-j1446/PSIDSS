const dashboardController = require('../controllers/dashboardController');
const historicalController = require('../controllers/historicalController');
const strategicController = require('../controllers/strategicController');
const predictiveController = require('../controllers/predictiveController');
const recommendationController = require('../controllers/recommendationController');
const simulationController = require('../controllers/simulationController');

const years = ['Recent4', 'All', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016'];

async function warmup() {
  console.log("Starting PSIDSS cache warmup for all years...");
  const mockRes = {
    json: () => {},
    status: () => ({ json: () => {} })
  };
  
  for (const year of years) {
    const mockReq = { 
      query: { year },
      body: {} 
    };
    
    try {
      console.log(`Preheating cache for Year: ${year}...`);
      await dashboardController.getKPIs(mockReq, mockRes);
      await historicalController.getRevenueTrends(mockReq, mockRes);
      await historicalController.getCustomerShares(mockReq, mockRes);
      await historicalController.getBerthTraffic(mockReq, mockRes);
      await historicalController.getCommodityDistribution(mockReq, mockRes);
      await historicalController.getGanttData(mockReq, mockRes);
      await strategicController.getStrategicAnalysis(mockReq, mockRes);
      await predictiveController.getForecasts(mockReq, mockRes);
      await recommendationController.getRecommendations(mockReq, mockRes);
      await simulationController.simulate(mockReq, mockRes);
    } catch (err) {
      console.error(`PSIDSS Cache warmup error for year ${year}:`, err);
    }
  }
  console.log("PSIDSS Cache warmup completed successfully for all years! 🚀");
}

module.exports = warmup;
