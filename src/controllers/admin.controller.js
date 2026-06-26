const { ConfiguracionSistema, AlertaTecnica } = require('../models/index');

// ── Configuración ──────────────────────────────────────────────

async function obtenerConfig(req, res) {
  try {
    const configs = await ConfiguracionSistema.findAll();
    // Convertir a objeto { clave: valor }
    const resultado = {};
    configs.forEach(c => { resultado[c.clave] = c.valor; });
    return res.json(resultado);
  } catch (err) {
    console.error('Error al obtener configuración:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizarConfig(req, res) {
  try {
    const { clave, valor } = req.body;
    if (!clave || valor === undefined) {
      return res.status(400).json({ error: 'clave y valor son requeridos' });
    }
    await ConfiguracionSistema.upsert({ clave, valor, descripcion: req.body.descripcion || null });
    return res.json({ mensaje: 'Configuración actualizada', clave, valor });
  } catch (err) {
    console.error('Error al actualizar configuración:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Alertas Técnicas ────────────────────────────────────────────

async function listarAlertas(req, res) {
  try {
    const alertas = await AlertaTecnica.findAll({
      order: [['fecha_creacion', 'DESC']],
      limit: 100,
    });
    return res.json(alertas);
  } catch (err) {
    console.error('Error al listar alertas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function marcarAlertaLeida(req, res) {
  try {
    const alerta = await AlertaTecnica.findByPk(req.params.id);
    if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });
    await alerta.update({ leida: true });
    return res.json(alerta);
  } catch (err) {
    console.error('Error al marcar alerta:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Endpoint helper: crear alerta técnica (para uso interno) ───
async function crearAlerta(tipo, modulo, mensaje) {
  try {
    await AlertaTecnica.create({ tipo, modulo, mensaje });
  } catch (err) {
    console.error('Error al crear alerta técnica:', err);
  }
}

module.exports = { obtenerConfig, actualizarConfig, listarAlertas, marcarAlertaLeida, crearAlerta };
