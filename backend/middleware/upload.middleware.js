const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads/submissions";
const resolvedDir = path.resolve(UPLOAD_DIR);
fs.mkdirSync(resolvedDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resolvedDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/jpg"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG images are allowed for painting submissions."));
  }
}

const maxSizeBytes = (Number(process.env.MAX_UPLOAD_MB) || 8) * 1024 * 1024;

const uploadPainting = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeBytes },
});

module.exports = { uploadPainting, UPLOAD_DIR: resolvedDir };
