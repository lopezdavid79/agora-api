const router = require('express').Router();
const { verificarToken, soloRoles } = require('../middlewares/auth.middleware');
const {
  obtenerPerfil,
  actualizarPerfil,
  obtenerCompletitud,
  validarPerfil,
} = require('../controllers/candidatos.controller');

router.use(verificarToken);

// GET  /api/candidatos/perfil
router.get('/perfil', soloRoles('Candidato', 'Gestor', 'Coordinador', 'Administrador'), obtenerPerfil);

// PUT  /api/candidatos/perfil
router.put('/perfil', soloRoles('Candidato', 'Gestor', 'Coordinador', 'Administrador'), validarPerfil, actualizarPerfil);

// GET  /api/candidatos/perfil/completitud
router.get('/perfil/completitud', soloRoles('Candidato', 'Gestor', 'Coordinador', 'Administrador'), obtenerCompletitud);

module.exports = router;
