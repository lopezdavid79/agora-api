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

// ── Raíz ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    mensaje: 'Bienvenido a la API de Ágora Argentina',
    estado: 'Online',
    fecha: new Date(),
  });
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Test bcrypt (temporal) ────────────────────────────────────
app.get('/api/test-bcrypt', async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('test123', 10);
    const match = await bcrypt.compare('test123', hash);
    res.json({ status: 'ok', bcrypt: 'working', match });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── Test login flow (temporal) ────────────────────────────────
app.get('/api/test-login-flow', async (req, res) => {
  const steps = [];
  try {
    steps.push('init');
    const { Usuario, CandidatoPerfil, Rol, RefreshToken } = require('./models/index');
    steps.push('models-loaded');

    const bcrypt = require('bcrypt');
    steps.push('bcrypt-loaded');

    const jwt = require('jsonwebtoken');
    steps.push('jwt-loaded');

    try { const usuario = await Usuario.findOne({ where: { email: 'test@test.com' } }); steps.push('usuario-query-ok'); } catch (e) { steps.push(`usuario-error: ${e.message}`); }
    try { const rol = await Rol.findOne(); steps.push('rol-query-ok'); } catch (e) { steps.push(`rol-error: ${e.message}`); }
    try { const rt = await RefreshToken.findOne(); steps.push('refresh-token-query-ok'); } catch (e) { steps.push(`refresh-error: ${e.message}`); }

    steps.push('jwt-secret-' + (process.env.JWT_SECRET ? 'ok' : 'missing'));

    res.json({ status: 'ok', steps });
  } catch (err) {
    res.json({ status: 'error', steps, message: err.message });
  }
});

// ── Test DB (temporal) ────────────────────────────────────────
app.get('/api/test-db', async (req, res) => {
  try {
    const { sequelize } = require('./config/database');
    await sequelize.authenticate();
    const [result] = await sequelize.query('SELECT 1+1 AS suma');
    const tablas = await sequelize.query(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
      { replacements: [process.env.DB_NAME] }
    );
    const [roles] = await sequelize.query('SELECT id, nombre FROM roles ORDER BY id');
    res.json({
      status: 'ok',
      db: process.env.DB_NAME,
      host: process.env.DB_HOST || 'localhost',
      suma: result[0].suma,
      tablas: tablas[0].map(t => Object.values(t)[0]),
      roles,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message, code: err.code });
  }
});

// ── Error handler global ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

module.exports = app;
