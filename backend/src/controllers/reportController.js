const { UploadedFile, PortRecord, Forecast } = require('../models');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cache = require('../utils/cache');

const reportController = {
  // 1. Get all uploaded sheets
  getReports: async (req, res) => {
    try {
      const files = await UploadedFile.findAll({
        order: [['upload_date', 'DESC']]
      });
      res.json(files);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to retrieve uploaded files' });
    }
  },

  // 2. Upload Excel sheet and trigger ingestion & forecasting
  uploadReport: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No Excel file provided' });
      }

      const filePath = req.file.path;
      const filename = req.file.filename;

      const pythonPath = process.env.PYTHON_PATH || 'python';
      const ingestScript = path.resolve(__dirname, '..', '..', '..', 'scripts', 'ingest.py');
      const forecastScript = path.resolve(__dirname, '..', '..', '..', 'scripts', 'forecast.py');

      console.log(`Running ingestion for file: ${filePath}`);
      console.time("upload-processing");
      // Execute ingest.py
      exec(`"${pythonPath}" "${ingestScript}" "${filePath}"`, async (ingestErr, ingestStdout, ingestStderr) => {
        if (ingestErr) {
          console.error('Ingestion script error:', ingestStderr);
          // Delete file on failure
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return res.status(500).json({ error: 'Ingestion failed', details: ingestStderr || ingestErr.message });
        }

        console.log('Ingestion success. Triggering forecast calculations...');
        
        // Execute forecast.py
        exec(`"${pythonPath}" "${forecastScript}"`, async (forecastErr, forecastStdout, forecastStderr) => {
          if (forecastErr) {
            console.error('Forecasting script error:', forecastStderr);
            return res.status(200).json({ 
              message: 'File uploaded and ingested, but forecast generation failed.',
              filename
            });
          }

          console.log('Forecast generation success!');
          console.timeEnd("upload-processing");
          try {
            const { syncPins } = require('../utils/pins');
            await syncPins();
          } catch (e) {
            console.error('Error syncing PINs on upload:', e);
          }
          cache.clear();
          try {
            const warmup = require('../utils/warmup');
            warmup();
          } catch (e) {}
          res.json({
            message: 'File uploaded, ingested, and predictions updated successfully! 🚀',
            filename
          });
        });
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Upload and parsing process failed' });
    }
  },

  // 3. Delete Excel sheet and all database records associated
  deleteReport: async (req, res) => {
    try {
      const { filename } = req.params;
      const fileRecord = await UploadedFile.findByPk(filename);
      
      if (!fileRecord) {
        return res.status(404).json({ error: 'File record not found' });
      }

      // Explicitly delete PortRecords first (to support SQLite if foreign keys are disabled)
      await PortRecord.destroy({ where: { report_filename: filename } });
      await UploadedFile.destroy({ where: { filename } });

      // Delete physical file
      const filePath = path.resolve(__dirname, '..', '..', 'uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Trigger forecasting to update projections after deleting records
      const pythonPath = process.env.PYTHON_PATH || 'python';
      const forecastScript = path.resolve(__dirname, '..', '..', '..', 'scripts', 'forecast.py');
      
      exec(`"${pythonPath}" "${forecastScript}"`, async (forecastErr, forecastStdout, forecastStderr) => {
        if (forecastErr) {
          console.error('Forecasting update failed during deletion:', forecastStderr);
        }
        try {
          const { syncPins } = require('../utils/pins');
          await syncPins();
        } catch (e) {
          console.error('Error syncing PINs on delete:', e);
        }
        cache.clear();
        try {
          const warmup = require('../utils/warmup');
          warmup();
        } catch (e) {}
        res.json({ message: 'File deleted and forecasts updated successfully!' });
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Deletion failed' });
    }
  },

  // 4. Force forecast regeneration manually
  regenerateForecasts: async (req, res) => {
    try {
      const pythonPath = process.env.PYTHON_PATH || 'python';
      const forecastScript = path.resolve(__dirname, '..', '..', '..', 'scripts', 'forecast.py');
      
      exec(`"${pythonPath}" "${forecastScript}"`, (err, stdout, stderr) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Forecasting failed', details: stderr });
        }
        cache.clear();
        try {
          const warmup = require('../utils/warmup');
          warmup();
        } catch (e) {}
        res.json({ message: 'Forecasts regenerated successfully!' });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Forecasting trigger failed' });
    }
  }
};

module.exports = reportController;
