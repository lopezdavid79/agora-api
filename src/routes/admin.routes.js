const router = require('express').Router();
const { verificarToken, soloRoles } = require('../middlewares/auth.middleware');
const { obtenerConfig, actualizarConfig, listarAlertas, marcarAlertaLeida } = require('../controllers/admin.controller');

router.use(verificarToken);
router.use(soloRoles('GestorTecnico', 'Administrador'));

router.get('/config', obtenerConfig);
router.put('/config', actualizarConfig);
router.get('/alertas', listarAlertas);
router.put('/alertas/:id/leer', marcarAlertaLeida);

module.exports = router;
