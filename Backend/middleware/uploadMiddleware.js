const multer = require('multer');

// Native Cloudinary Multer Storage Engine (eliminates incompatible third-party dependencies)
class CloudinaryStorage {
  constructor(opts) {
    if (!opts || !opts.cloudinary) {
      throw new Error('`cloudinary` option is required for CloudinaryStorage');
    }
    this.cloudinary = opts.cloudinary;
    this.params = opts.params || {};
  }

  async _getParams(req, file) {
    let resolved = {};
    if (typeof this.params === 'function') {
      resolved = await this.params(req, file);
    } else if (this.params && typeof this.params === 'object') {
      resolved = { ...this.params };
      for (const [key, value] of Object.entries(resolved)) {
        if (typeof value === 'function') {
          resolved[key] = await value(req, file);
        }
      }
    }
    return resolved;
  }

  _handleFile(req, file, cb) {
    this._getParams(req, file)
      .then((uploadParams) => {
        const stream = this.cloudinary.uploader.upload_stream(
          uploadParams,
          (error, result) => {
            if (error) {
              return cb(error);
            }
            cb(null, {
              path: result.secure_url || result.url,
              secure_url: result.secure_url,
              url: result.url,
              public_id: result.public_id,
              filename: result.public_id,
              format: result.format,
              resource_type: result.resource_type,
              bytes: result.bytes,
              ...result
            });
          }
        );
        file.stream.pipe(stream);
      })
      .catch((err) => cb(err));
  }

  _removeFile(req, file, cb) {
    const publicId = file.filename || file.public_id;
    if (publicId) {
      this.cloudinary.uploader.destroy(publicId, { invalidate: true }, cb);
    } else {
      cb(null);
    }
  }
}

const cloudinary = require('../config/cloudinary');

// Configure Cloudinary Storage with optimization
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'appzeto',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
    // Apply quality-preserving optimization on upload
    transformation: [
      { quality: 'auto:good', fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const name = file.originalname.split('.')[0];
      return `${name}-${Date.now()}`;
    }
  }
});

// Configure Cloudinary Storage for videos
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'appzeto_videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
    public_id: (req, file) => {
      const name = file.originalname.split('.')[0];
      return `${name}-video-${Date.now()}`;
    }
  }
});

// Configure memory storage (backup/legacy)
const memoryStorage = multer.memoryStorage();

// File filter - only images
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// File filter - only videos
const videoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed!'), false);
  }
};

// File filter - images and documents
const documentFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images and PDF/DOC files are allowed!'), false);
  }
};

// Configure Cloudinary Storage for shop licenses/docs
const shopLicenseStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isDoc = file.mimetype === 'application/pdf';
    return {
      folder: 'shop_licenses',
      resource_type: isDoc ? 'raw' : 'image',
      allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
      public_id: `${file.originalname.split('.')[0]}-${Date.now()}`
    };
  }
});

// File filter - images and PDF
const shopLicenseFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPG, PNG) and PDF files are allowed!'), false);
  }
};

// Generic Image Upload (Cloudinary) - Expecting 'file' field
const uploadImage = multer({
  storage: cloudinaryStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('file');

// Generic Video Upload (Cloudinary)
const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for videos
  }
}).single('file');

// Shop License Upload (Cloudinary)
const uploadShopLicense = multer({
  storage: shopLicenseStorage,
  fileFilter: shopLicenseFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for docs
  }
}).single('file');

// Profile photo upload (legacy/specific) - Expecting 'photo' field
const uploadProfilePhoto = multer({
  storage: cloudinaryStorage, // Updated to use Cloudinary
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
}).single('photo');

// Document upload (multiple files)
const uploadDocuments = multer({
  storage: memoryStorage, // Keep memory for docs for now or update if needed
  fileFilter: documentFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
}).fields([
  { name: 'aadhar', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'otherDocuments', maxCount: 5 }
]);

// Error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded.'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

module.exports = {
  uploadImage,
  uploadVideo,
  uploadShopLicense,
  uploadProfilePhoto,
  uploadDocuments,
  handleMulterError
};
