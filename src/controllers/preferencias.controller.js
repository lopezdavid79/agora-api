const { PreferenciaUsuario } = require('../models/index');

// GET /api/preferencias
async function obtenerPreferencias(req, res) {
  try {
    let pref = await PreferenciaUsuario.findOne({
      where: { usuarioId: req.usuario.id },
    });

    // Si no existen, crear con valores por defecto
    if (!pref) {
      pref = await PreferenciaUsuario.create({ usuarioId: req.usuario.id });
    }

    return res.json(pref);
  } catch (err) {
    console.error('Error al obtener preferencias:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /api/preferencias
async function actualizarPreferencias(req, res) {
  try {
    const camposPermitidos = ['modoOscuro', 'tamanoFuente', 'altoContraste'];
    const datos = {};

    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        datos[campo] = req.body[campo];
      }
    }

    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos válidos para actualizar' });
    }

    // upsert: crea si no existe, actualiza si existe
    const [pref, creado] = await PreferenciaUsuario.upsert({
      usuarioId: req.usuario.id,
      ...datos,
    });

    return res.status(creado ? 201 : 200).json(pref);
  } catch (err) {
    console.error('Error al actualizar preferencias:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { obtenerPreferencias, actualizarPreferencias };
