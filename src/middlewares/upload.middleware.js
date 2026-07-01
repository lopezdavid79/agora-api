const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── Asegurar que el directorio de subida existe ──────────────
const storageDir = path.join(__dirname, '..', '..', 'storage', 'documentos');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// ── Configuración de almacenamiento ───────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, storageDir);
  },
  filename(req, file, cb) {
    const tipo      = req.body.tipoDocumento || 'Otro';
    const usuarioId = req.usuario.id; // proxy único del perfil del candidato
    const sufijo    = Date.now();
    const ext       = path.extname(file.originalname);
    cb(null, `${usuarioId}-${tipo}-${sufijo}${ext}`);
  },
});

// ── Filtro de tipos permitidos ────────────────────────────────
const MIME_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

function fileFilter(req, file, cb) {
  if (MIME_PERMITIDOS.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo PDF, JPEG, PNG, DOC, DOCX y TXT.'), false);
  }
}

// ── Middleware configurado ─────────────────────────────────────
const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

module.exports = { uploadMiddleware };
