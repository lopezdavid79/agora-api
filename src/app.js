const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// ── Orígenes permitidos para CORS ─────────────────────────────
// Usar CORS_ORIGINS (separado por comas) o FRONTEND_URL (legacy).
// Ej: CORS_ORIGINS=http://localhost:5173,https://app.agora.com
const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ── Middlewares globales ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin Origin (curl, server-to-server, etc.)
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/candidatos',    require('./routes/candidatos.routes'));
app.use('/api/documentos',    require('./routes/documentos.routes'));
app.use('/api/notificaciones',require('./routes/notificaciones.routes'));
app.use('/api/catalogos',      require('./routes/catalogos.routes'));
app.use('/api/gestor',         require('./routes/gestor.routes'));
app.use('/api/preferencias',   require('./routes/preferencias.routes'));
app.use('/api/admin',          require('./routes/admin.routes'));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Error handler global ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

module.exports = app;
