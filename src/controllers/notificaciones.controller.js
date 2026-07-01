const { Op } = require('sequelize');
const { Notificacion, Usuario } = require('../models/index');

// ── GET /api/notificaciones ────────────────────────────────────
async function listarNotificaciones(req, res) {
  try {
    const page   = parseInt(req.query.page, 10)   || 1;
    const limit  = parseInt(req.query.limit, 10)  || 20;
    const offset = (page - 1) * limit;

    const { count: total, rows: notificaciones } = await Notificacion.findAndCountAll({
      where: { usuarioId: req.usuario.id },
      order: [['fecha_envio', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      notificaciones,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Error al listar notificaciones:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/notificaciones ───────────────────────────────────
async function crearNotificacion(req, res) {
  try {
    const { usuarioId, asunto, mensaje } = req.body;

    if (!usuarioId || !asunto || !mensaje) {
      return res.status(400).json({ error: 'usuarioId, asunto y mensaje son requeridos' });
    }

    // Validar que el usuario destinatario exista
    const destinatario = await Usuario.findByPk(usuarioId);
    if (!destinatario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const notificacion = await Notificacion.create({
      usuarioId,
      emisorId: req.usuario.id,
      asunto,
      mensaje,
    });

    return res.status(201).json(notificacion);
  } catch (err) {
    console.error('Error al crear notificacion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/notificaciones/:id/leer ───────────────────────────
async function marcarComoLeida(req, res) {
  try {
    const notificacion = await Notificacion.findOne({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });

    if (!notificacion) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    await notificacion.update({
      leida: true,
      fechaLectura: new Date(),
    });

    return res.json(notificacion);
  } catch (err) {
    console.error('Error al marcar notificacion como leida:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/notificaciones/nuevas ─────────────────────────────
async function nuevasNotificaciones(req, res) {
  try {
    const where = {
      usuarioId: req.usuario.id,
      leida: false,
    };

    if (req.query.desde) {
      where.fecha_envio = { [Op.gt]: new Date(req.query.desde) };
    }

    const notificaciones = await Notificacion.findAll({
      where,
      attributes: ['id'],
    });

    return res.json({
      cantidad: notificaciones.length,
      ids: notificaciones.map(n => n.id),
    });
  } catch (err) {
    console.error('Error al obtener nuevas notificaciones:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/notificaciones/masiva ────────────────────────────
async function crearNotificacionMasiva(req, res) {
  try {
    const { asunto, mensaje } = req.body;

    if (!asunto || !mensaje) {
      return res.status(400).json({ error: 'asunto y mensaje son requeridos' });
    }

    // Buscar todos los candidatos activos
    const candidatos = await Usuario.findAll({
      where: { rol: 'Candidato', activo: true },
      attributes: ['id'],
    });

    if (candidatos.length === 0) {
      return res.status(404).json({ error: 'No hay candidatos activos' });
    }

    const notificaciones = candidatos.map(c => ({
      usuarioId: c.id,
      emisorId: req.usuario.id,
      asunto,
      mensaje,
    }));

    await Notificacion.bulkCreate(notificaciones);

    return res.status(201).json({
      mensaje: `Notificación enviada a ${candidatos.length} candidatos`,
      cantidad: candidatos.length,
    });
  } catch (err) {
    console.error('Error al crear notificación masiva:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/notificaciones/selectiva ─────────────────────────
async function crearNotificacionSelectiva(req, res) {
  try {
    const { usuarioIds, asunto, mensaje } = req.body;

    if (!usuarioIds || !Array.isArray(usuarioIds) || usuarioIds.length === 0) {
      return res.status(400).json({ error: 'usuarioIds debe ser un array no vacío' });
    }
    if (!asunto || !mensaje) {
      return res.status(400).json({ error: 'asunto y mensaje son requeridos' });
    }

    // Validar que los usuarios existan
    const usuarios = await Usuario.findAll({
      where: { id: { [Op.in]: usuarioIds } },
      attributes: ['id'],
    });

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Ningún usuario encontrado' });
    }

    const notificaciones = usuarios.map(u => ({
      usuarioId: u.id,
      emisorId: req.usuario.id,
      asunto,
      mensaje,
    }));

    await Notificacion.bulkCreate(notificaciones);

    return res.status(201).json({
      mensaje: `Notificación enviada a ${usuarios.length} usuarios`,
      cantidad: usuarios.length,
      noEncontrados: usuarioIds.length - usuarios.length,
    });
  } catch (err) {
    console.error('Error al crear notificación selectiva:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── DELETE /api/notificaciones/:id ─────────────────────────────
async function eliminarNotificacion(req, res) {
  try {
    const notificacion = await Notificacion.findOne({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });

    if (!notificacion) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    await notificacion.destroy();

    return res.json({ mensaje: 'Notificación eliminada' });
  } catch (err) {
    console.error('Error al eliminar notificacion:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listarNotificaciones, crearNotificacion, crearNotificacionMasiva, crearNotificacionSelectiva, marcarComoLeida, eliminarNotificacion, nuevasNotificaciones };
