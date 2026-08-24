// server/middleware/upload.js
// Middleware to handle file uploads (payment proofs, digital products)

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Destination folder for payment proofs (private)
const proofsDir = path.join(__dirname, '../../storage/payment_proofs');
if (!fs.existsSync(proofsDir)) {
  fs.mkdirSync(proofsDir, { recursive: true });
}

// Destination folder for digital product files (private)
const digitalDir = path.join(__dirname, '../../storage/digital_files');
if (!fs.existsSync(digitalDir)) {
  fs.mkdirSync(digitalDir, { recursive: true });
}

// File filter – allow only images and pdf for proofs, any file for digital products
function fileFilter(req, file, cb) {
  // If endpoint is for proof upload, restrict extensions
  if (req.path.includes('proof')) {
    const allowed = /\.(jpg|jpeg|png|pdf)$/i;
    if (!allowed.test(file.originalname)) {
      return cb(new Error('Only JPG, JPEG, PNG, PDF files are allowed for proofs'), false);
    }
  }
  // Accept all other files (digital product uploads) – could be further validated later
  cb(null, true);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (req.path.includes('proof')) {
      cb(null, proofsDir);
    } else {
      cb(null, digitalDir);
    }
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: fileFilter
});

module.exports = upload;
