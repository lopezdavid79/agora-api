const router = require('express').Router();
const { verificarToken, soloRoles } = require('../middlewares/auth.middleware');
const {
  listarCatalogos,
  crearCatalogo,
  actualizarCatalogo,
  eliminarCatalogo,
  deshabilitarCatalogo,
  usuariosAfectados,
} = require('../controllers/catalogos.controller');

router.use(verificarToken);

router.get('/',                                              listarCatalogos);
router.post('/',                 soloRoles('Gestor', 'Coordinador', 'Administrador'), crearCatalogo);
router.put('/:id',               soloRoles('Gestor', 'Coordinador', 'Administrador'), actualizarCatalogo);
router.delete('/:id',            soloRoles('Gestor', 'Coordinador', 'Administrador'), eliminarCatalogo);
router.put('/:id/deshabilitar',  soloRoles('Gestor', 'Coordinador', 'Administrador'), deshabilitarCatalogo);
router.get('/:id/usuarios-afectados', soloRoles('Gestor', 'Coordinador', 'Administrador'), usuariosAfectados);

module.exports = router;
