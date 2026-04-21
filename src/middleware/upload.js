const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const petsDir = path.join(uploadDir, 'pets');
const certsDir = path.join(uploadDir, 'certificates');
const docsDir = path.join(uploadDir, 'doctors');
const shopsDir = path.join(uploadDir, 'shops');

[petsDir, certsDir, docsDir, shopsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = uploadDir;
    if (req.baseUrl.includes('/pets')) {
      dest = file.fieldname === 'certificate' ? certsDir : petsDir;
    } else if (req.baseUrl.includes('/doctors')) {
      dest = docsDir;
    } else if (req.baseUrl.includes('/shops')) {
      dest = shopsDir;
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png and .pdf files are allowed'));
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024, // default 10MB
  },
  fileFilter: fileFilter
});

module.exports = { upload };
