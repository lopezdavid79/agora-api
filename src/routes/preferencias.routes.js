const router = require('express').Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { obtenerPreferencias, actualizarPreferencias } = require('../controllers/preferencias.controller');

router.use(verificarToken);

router.get('/', obtenerPreferencias);
router.put('/', actualizarPreferencias);

module.exports = router;
