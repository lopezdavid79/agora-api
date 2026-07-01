const router = require('express').Router();
const { verificarToken, soloRoles } = require('../middlewares/auth.middleware');
const {
  buscarCandidatos,
  exportarExcel,
  fichaCandidato,
  cambiarEstado,
  marcarObservacion,
} = require('../controllers/gestor.controller');
const {
  crearNota,
  listarNotas,
  editarNota,
  historialNota,
} = require('../controllers/notas.controller');

router.use(verificarToken);
router.use(soloRoles('Gestor', 'Coordinador', 'Administrador'));

router.get('/candidatos/buscar', buscarCandidatos);
router.get('/candidatos/exportar', exportarExcel);
router.get('/candidatos/:id', fichaCandidato);
router.put('/candidatos/:id/estado', cambiarEstado);
router.post('/candidatos/:id/notas', crearNota);
router.get('/candidatos/:id/notas', listarNotas);
router.put('/candidatos/:id/notas/:nid', editarNota);
router.post('/candidatos/:id/observacion', marcarObservacion);

// ── Adjuntos de notas ────────────────────────────────────────────
const { uploadMiddleware } = require('../middlewares/upload.middleware');
const {
  subirAdjunto, listarAdjuntos, descargarAdjunto, eliminarAdjunto,
} = require('../controllers/adjuntos.controller');

router.post('/candidatos/:id/notas/:nid/adjuntos', uploadMiddleware.single('archivo'), subirAdjunto);
router.get('/candidatos/:id/notas/:nid/adjuntos', listarAdjuntos);
router.get('/candidatos/:id/notas/:nid/adjuntos/:aid', descargarAdjunto);
router.delete('/candidatos/:id/notas/:nid/adjuntos/:aid', eliminarAdjunto);

// ── Gestión de Usuarios ──────────────────────────────────────────
const {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  suspenderUsuario,
  reactivarUsuario,
  cambiarRol,
} = require('../controllers/usuarios.controller');

router.get('/usuarios', listarUsuarios);
router.get('/usuarios/:id', obtenerUsuario);
router.post('/usuarios', soloRoles('Coordinador', 'Administrador'), crearUsuario);
router.put('/usuarios/:id', soloRoles('Coordinador', 'Administrador'), editarUsuario);
router.delete('/usuarios/:id', soloRoles('Administrador'), eliminarUsuario);
router.put('/usuarios/:id/suspender', suspenderUsuario);
router.put('/usuarios/:id/reactivar', reactivarUsuario);
router.put('/usuarios/:id/rol', soloRoles('Coordinador', 'Administrador'), cambiarRol);

// ── Reset de contraseña ──────────────────────────────────────────
const { resetearPassword } = require('../controllers/gestor.controller');
router.put('/usuarios/:id/resetear-password', resetearPassword);

// ── Papelera de documentos ──────────────────────────────────────
const { listarPapelera, restaurarDocumento, purgarPapelera } = require('../controllers/papelera.controller');

router.get('/papelera', listarPapelera);
router.post('/papelera/:id/restaurar', restaurarDocumento);
router.delete('/papelera/purga', purgarPapelera);

// ── Historial de notas ──────────────────────────────────────────
// historialNota importada desde notas.controller arriba
router.get('/candidatos/:id/notas/:nid/historial', historialNota);

module.exports = router;
