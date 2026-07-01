const router = require('express').Router();
const { verificarToken, soloRoles } = require('../middlewares/auth.middleware');
const {
  listarNotificaciones,
  crearNotificacion,
  crearNotificacionMasiva,
  crearNotificacionSelectiva,
  marcarComoLeida,
  eliminarNotificacion,
  nuevasNotificaciones,
} = require('../controllers/notificaciones.controller');

router.use(verificarToken);

router.get('/', listarNotificaciones);
router.get('/nuevas', nuevasNotificaciones);
router.post('/', soloRoles('Gestor', 'Coordinador', 'Administrador'), crearNotificacion);
router.post('/masiva', soloRoles('Gestor', 'Coordinador', 'Administrador'), crearNotificacionMasiva);
router.post('/selectiva', soloRoles('Gestor', 'Coordinador', 'Administrador'), crearNotificacionSelectiva);
router.put('/:id/leer', marcarComoLeida);
router.delete('/:id', eliminarNotificacion);

module.exports = router;
