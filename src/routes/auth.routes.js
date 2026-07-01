const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { login, me, registrar, refresh, logout, validarLogin, validarRegistro } = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // 15 minutes
  max: 5,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente nuevamente más tarde.' },
});

const slowLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,       // 1 hour
  max: 3,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente nuevamente más tarde.' },
});

// POST /api/auth/registro
router.post('/registro', slowLimiter, validarRegistro, registrar);

// POST /api/auth/login
router.post('/login', loginLimiter, validarLogin, login);

// POST /api/auth/refresh (renueva access token)
router.post('/refresh', refresh);

// POST /api/auth/logout
router.post('/logout', logout);

// GET  /api/auth/me  (requiere token)
router.get('/me', verificarToken, me);

// PUT  /api/auth/cambiar-password (requiere token)
const { cambiarPassword, validarCambioPassword } = require('../controllers/password.controller');
router.put('/cambiar-password', verificarToken, validarCambioPassword, cambiarPassword);

// POST /api/auth/cambiar-vista (multi-rol)
const { cambiarVista } = require('../controllers/auth.controller');
router.post('/cambiar-vista', verificarToken, cambiarVista);

// POST /api/auth/resetear-password (canjea token — sin auth)
const { resetearPasswordToken } = require('../controllers/auth.controller');
router.post('/resetear-password', slowLimiter, resetearPasswordToken);

module.exports = router;
