const path = require('path');

/*
|--------------------------------------------------------------------------
| Force working directory to backend root
|--------------------------------------------------------------------------
| Your server.js is inside backend/src.
| If Sequelize uses a relative SQLite path like "database.sqlite",
| running node server.js from backend/src can make it connect to:
| backend/src/database.sqlite
|
| This forces it to use:
| backend/database.sqlite
*/
const backendRoot = path.resolve(__dirname, '..');
process.chdir(backendRoot);

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

require('dotenv').config({ path: path.join(backendRoot, '.env') });

const { sequelize } = require('./models');
const { authenticateJWT, requireRole } = require('./middleware/auth');

// Controllers
const authController = require('./controllers/authController');
const dashboardController = require('./controllers/dashboardController');
const historicalController = require('./controllers/historicalController');
const strategicController = require('./controllers/strategicController');
const predictiveController = require('./controllers/predictiveController');
const simulationController = require('./controllers/simulationController');
const recommendationController = require('./controllers/recommendationController');
const reportController = require('./controllers/reportController');
const chatbotController = require('./controllers/chatbotController');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Uploads folder
const uploadsDir = path.join(backendRoot, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

// Public Routes
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);

// Dashboard
app.get('/api/dashboard/kpis', authenticateJWT, dashboardController.getKPIs);

// Historical Analytics
app.get('/api/historical/trends', authenticateJWT, historicalController.getRevenueTrends);
app.get('/api/historical/customers', authenticateJWT, historicalController.getCustomerShares);
app.get('/api/historical/berths', authenticateJWT, historicalController.getBerthTraffic);
app.get('/api/historical/commodities', authenticateJWT, historicalController.getCommodityDistribution);
app.get('/api/historical/gantt', authenticateJWT, historicalController.getGanttData);
app.get('/api/berth-timeline', authenticateJWT, historicalController.getGanttData);

// Strategic Analytics
app.get(
  '/api/strategic/analysis',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  strategicController.getStrategicAnalysis
);

// Predictive Analytics
app.get(
  '/api/predictive/forecasts',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  predictiveController.getForecasts
);

// Recommendations
app.get(
  '/api/recommendations',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  recommendationController.getRecommendations
);

// Simulation
app.post(
  '/api/simulation/run',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin', 'Party', 'VCN']),
  simulationController.simulate
);

// Chatbot
app.post(
  '/api/chatbot/ask',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  chatbotController.ask
);
app.get(
  '/api/chatbot/sessions',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  chatbotController.getSessions
);
app.post(
  '/api/chatbot/sessions',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  chatbotController.createSession
);
app.get(
  '/api/chatbot/sessions/:id/messages',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  chatbotController.getSessionMessages
);
app.delete(
  '/api/chatbot/sessions/:id',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  chatbotController.deleteSession
);
app.delete(
  '/api/chatbot/sessions',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  chatbotController.clearAllSessions
);

// Reports
app.get(
  '/api/reports',
  authenticateJWT,
  requireRole(['Viewer', 'Analyst', 'Admin']),
  reportController.getReports
);

app.post(
  '/api/reports',
  authenticateJWT,
  requireRole(['Admin']),
  upload.single('file'),
  reportController.uploadReport
);

app.delete(
  '/api/reports/:filename',
  authenticateJWT,
  requireRole(['Admin']),
  reportController.deleteReport
);

app.post(
  '/api/reports/regenerate-forecasts',
  authenticateJWT,
  requireRole(['Admin']),
  reportController.regenerateForecasts
);

// Admin PIN Routes
const { PartyPin, VcnPin } = require('./models');
const { generate6DigitPin } = require('./utils/pins');

app.get('/api/admin/pins/parties', authenticateJWT, requireRole(['Admin']), async (req, res) => {
  try {
    const list = await PartyPin.findAll({ order: [['party_name', 'ASC']] });
    res.json(list);
  } catch (err) {
    console.error('[PIN PARTY LIST ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve Party PINs' });
  }
});

app.get('/api/admin/pins/vcns', authenticateJWT, requireRole(['Admin']), async (req, res) => {
  try {
    const list = await VcnPin.findAll({ order: [['vcn', 'ASC']] });
    res.json(list);
  } catch (err) {
    console.error('[PIN VCN LIST ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve VCN PINs' });
  }
});

app.post('/api/admin/pins/parties/regenerate', authenticateJWT, requireRole(['Admin']), async (req, res) => {
  try {
    const { party_name } = req.body;

    if (!party_name) {
      return res.status(400).json({ error: 'Party Name is required' });
    }

    const record = await PartyPin.findByPk(party_name);

    if (!record) {
      return res.status(404).json({ error: 'Party Name not found' });
    }

    record.pin = generate6DigitPin();
    await record.save();

    res.json({ message: 'PIN regenerated successfully', record });
  } catch (err) {
    console.error('[PARTY PIN REGEN ERROR]', err);
    res.status(500).json({ error: 'Failed to regenerate PIN' });
  }
});

app.post('/api/admin/pins/vcns/regenerate', authenticateJWT, requireRole(['Admin']), async (req, res) => {
  try {
    const { vcn } = req.body;

    if (!vcn) {
      return res.status(400).json({ error: 'VCN is required' });
    }

    const record = await VcnPin.findByPk(vcn);

    if (!record) {
      return res.status(404).json({ error: 'VCN not found' });
    }

    record.pin = generate6DigitPin();
    await record.save();

    res.json({ message: 'PIN regenerated successfully', record });
  } catch (err) {
    console.error('[VCN PIN REGEN ERROR]', err);
    res.status(500).json({ error: 'Failed to regenerate PIN' });
  }
});

// Express Error Handler
app.use((err, req, res, next) => {
  console.error('[EXPRESS ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ---------------------------------------------------------
// DATABASE HELPERS
// ---------------------------------------------------------

async function ensureSourceYearColumn() {
  try {
    const dialect = sequelize.options.dialect;

    console.log('Checking PortRecords table schema...');

    if (dialect === 'sqlite') {
      const [columns] = await sequelize.query(`PRAGMA table_info('PortRecords')`);

      const hasSourceYear = columns.some((col) => col.name === 'source_year');

      if (!hasSourceYear) {
        console.log('source_year column missing. Adding source_year column...');
        await sequelize.query(`ALTER TABLE PortRecords ADD COLUMN source_year INTEGER`);
        console.log('source_year column added successfully.');
      } else {
        console.log('source_year column already exists.');
      }
    }

    if (dialect === 'mysql') {
      const [columns] = await sequelize.query(`
        SHOW COLUMNS FROM PortRecords LIKE 'source_year'
      `);

      if (!columns || columns.length === 0) {
        console.log('source_year column missing. Adding source_year column...');
        await sequelize.query(`ALTER TABLE PortRecords ADD COLUMN source_year INT NULL`);
        console.log('source_year column added successfully.');
      } else {
        console.log('source_year column already exists.');
      }
    }
  } catch (err) {
    if (
      err.message &&
      (
        err.message.includes('no such table') ||
        err.message.includes("doesn't exist")
      )
    ) {
      console.log('PortRecords table does not exist yet. Sequelize will create it.');
    } else {
      console.error('Failed while checking/adding source_year column:', err);
      throw err;
    }
  }
}

async function backfillSourceYear() {
  try {
    const dialect = sequelize.options.dialect;

    const yearExp =
      dialect === 'mysql'
        ? 'YEAR(invoice_date)'
        : "strftime('%Y', invoice_date)";

    await sequelize.query(`
      UPDATE PortRecords
      SET source_year = CAST(${yearExp} AS INTEGER)
      WHERE source_year IS NULL
      AND invoice_date IS NOT NULL
    `);

    console.log('Successfully backfilled source_year values.');
  } catch (err) {
    console.error('Failed to backfill source_year:', err);
  }
}

async function verifyDatabaseData() {
  try {
    const dbInfo = sequelize.config || {};

    console.log('--------------------------------------------------');
    console.log('DATABASE DEBUG INFO');
    console.log('Current working directory:', process.cwd());
    console.log('Backend root:', backendRoot);
    console.log('Dialect:', sequelize.options.dialect);

    if (sequelize.options.dialect === 'sqlite') {
      console.log('SQLite storage:', sequelize.options.storage || dbInfo.storage || 'Not shown');
      console.log('Expected SQLite file:', path.join(backendRoot, 'database.sqlite'));
    }

    const countResult = await sequelize.query(
      `SELECT COUNT(*) AS count FROM PortRecords`,
      { type: sequelize.QueryTypes ? sequelize.QueryTypes.SELECT : undefined }
    ).catch(async () => {
      return await sequelize.query(
        `SELECT COUNT(*) AS count FROM PortRecords`,
        { type: require('sequelize').QueryTypes.SELECT }
      );
    });

    const revenueResult = await sequelize.query(
      `
      SELECT
        COUNT(*) AS records,
        COALESCE(SUM(invoice_amount), 0) AS revenue
      FROM PortRecords
      `,
      { type: require('sequelize').QueryTypes.SELECT }
    );

    const yearlyResult = await sequelize.query(
      `
      SELECT
        source_year,
        COUNT(*) AS records,
        ROUND(COALESCE(SUM(invoice_amount), 0), 2) AS revenue
      FROM PortRecords
      GROUP BY source_year
      ORDER BY source_year
      `,
      { type: require('sequelize').QueryTypes.SELECT }
    );

    console.log('PortRecords count:', countResult[0]?.count);
    console.log('Total records/revenue:', revenueResult[0]);
    console.log('Yearly revenue check:', yearlyResult);
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('[DATABASE VERIFICATION ERROR]', err);
  }
}

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------

async function startServer() {
  try {
    console.log('Connecting to database...');
    console.log('Forced backend root:', backendRoot);
    console.log('Current working directory:', process.cwd());

    await sequelize.authenticate();
    console.log('Database connected successfully.');

    await ensureSourceYearColumn();

    await sequelize.sync();
    console.log('Database synchronized successfully.');

    // Create database indexes on PortRecords if they don't already exist
    try {
      console.log('Verifying SQLite indexes...');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_source_year ON PortRecords(source_year);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_invoice_date ON PortRecords(invoice_date);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_berth ON PortRecords(berth);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_party ON PortRecords(party_name);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_commodity_group ON PortRecords(commodity_group);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_commodity ON PortRecords(commodity);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_vcn ON PortRecords(vcn);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_ata ON PortRecords(ata);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_vessel_name ON PortRecords(vessel_name);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_year_berth ON PortRecords(source_year, berth);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_year_party ON PortRecords(source_year, party_name);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_year_commodity ON PortRecords(source_year, commodity);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_port_year_commodity_group ON PortRecords(source_year, commodity_group);');
      console.log('SQLite indexes verified successfully.');
    } catch (indexErr) {
      console.error('Error creating database indexes:', indexErr);
    }

    await backfillSourceYear();

    await verifyDatabaseData();

    await authController.seedUsers();

    try {
      const { syncPins } = require('./utils/pins');
      await syncPins();
    } catch (e) {
      console.error('Failed to sync portal pins:', e);
    }

    try {
      const warmup = require('./utils/warmup');
      warmup();
    } catch (e) {
      console.error('Failed to trigger warmup:', e);
    }

    const server = app.listen(PORT, () => {
      console.log(`PSIDSS Backend Server running on port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the old node process and try again.`);
      } else {
        console.error('[SERVER ERROR]', err);
      }
    });
  } catch (err) {
    console.error('Database sync failed:', err);
  }
}

startServer();