// routes/upload.js - Updated for Private Storage
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadToBlob } = require('../config/storage');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// POST /api/upload - Upload file to private blob storage
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const originalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${originalName}`;
    
    // Upload to private blob storage
    const blobUrl = await uploadToBlob(
      fileName,
      req.file.buffer,
      req.file.mimetype
    );
    
    res.json({
      message: 'File uploaded successfully',
      fileName: fileName,
      blobUrl: blobUrl, // This is the private blob URL
      size: req.file.size
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;