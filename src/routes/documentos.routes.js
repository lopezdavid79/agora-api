const router = require('express').Router();
const { verificarToken, soloRoles } = require('../middlewares/auth.middleware');
const { uploadMiddleware } = require('../middlewares/upload.middleware');
const {
  subirDocumento,
  listarDocumentos,
  eliminarDocumento,
  descargarDocumento,
} = require('../controllers/documentos.controller');

router.use(verificarToken);

router.get('/', listarDocumentos);
router.post('/subir', soloRoles('Candidato'), uploadMiddleware.single('archivo'), subirDocumento);
router.delete('/:id', eliminarDocumento);
router.get('/:id/descargar', descargarDocumento);

module.exports = router;
