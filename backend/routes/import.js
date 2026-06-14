const express = require('express');
const multer = require('multer');
const { processCSV } = require('../importer');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { data: cleanedData, anomalies } = await processCSV(req.file.path);
    
    // We send back the report for the frontend to display, and Meera to approve
    res.json({
      success: true,
      report: {
        anomalies,
        data_preview: cleanedData,
        total_rows_processed: cleanedData.length + anomalies.filter(a => a.action === 'skip').length
      }
    });
  } catch (error) {
    console.error("CSV Processing Error:", error);
    res.status(500).json({ error: 'Failed to process CSV file' });
  }
});

module.exports = router;
