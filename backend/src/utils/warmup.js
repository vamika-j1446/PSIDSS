const dashboardController = require('../controllers/dashboardController');
const historicalController = require('../controllers/historicalController');
const strategicController = require('../controllers/strategicController');
const predictiveController = require('../controllers/predictiveController');
const recommendationController = require('../controllers/recommendationController');
const simulationController = require('../controllers/simulationController');

const years = ['Recent4', 'All'];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function warmup() {
  // Wait 1.5 seconds after server start to let the port establish first
  await delay(1500);

  console.log("Starting PSIDSS cache warmup for default scopes...");
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
      await delay(100);
      
      await historicalController.getRevenueTrends(mockReq, mockRes);
      await delay(100);
      
      await historicalController.getCustomerShares(mockReq, mockRes);
      await delay(100);
      
      await historicalController.getBerthTraffic(mockReq, mockRes);
      await delay(100);
      
      await historicalController.getCommodityDistribution(mockReq, mockRes);
      await delay(100);
      
      await historicalController.getGanttData(mockReq, mockRes);
      await delay(100);
      
      await strategicController.getStrategicAnalysis(mockReq, mockRes);
      await delay(100);
      
      await predictiveController.getForecasts(mockReq, mockRes);
      await delay(100);
      
      await recommendationController.getRecommendations(mockReq, mockRes);
      await delay(100);
      
      await simulationController.simulate(mockReq, mockRes);
      await delay(250); // Pause between years
    } catch (err) {
      console.error(`PSIDSS Cache warmup error for year ${year}:`, err);
    }
  }
  console.log("PSIDSS Cache warmup completed successfully for default scopes! 🚀");
}

module.exports = warmup;
