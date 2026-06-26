const { Op } = require('sequelize');
const fs = require('fs');
const { Documento, CandidatoPerfil } = require('../models/index');
const { purgarDocumentos } = require('../jobs/purga-documentos');

// ── GET /api/gestor/papelera ──────────────────────────────────
async function listarPapelera(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const { perfilId } = req.query;

    const where = {
      deletedAt: { [Op.ne]: null },
    };

    if (perfilId) {
      where.perfilId = perfilId;
    }

    const { count, rows } = await Documento.findAndCountAll({
      where,
      include: [{
        model: CandidatoPerfil,
        as: 'perfil',
        attributes: ['id', 'nombre', 'apellido'],
      }],
      offset,
      limit,
      distinct: true,
      order: [['deletedAt', 'DESC']],
    });

    return res.json({
      documentos: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error('Error al listar papelera:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/gestor/papelera/:id/restaurar ───────────────────
async function restaurarDocumento(req, res) {
  try {
    const documento = await Documento.findByPk(req.params.id);

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (!documento.deletedAt) {
      return res.status(400).json({ error: 'El documento no está eliminado' });
    }

    await documento.update({ deletedAt: null });

    return res.json({ mensaje: 'Documento restaurado correctamente', documento });
  } catch (err) {
    console.error('Error al restaurar documento:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── DELETE /api/gestor/papelera/purga ─────────────────────────
async function purgarPapelera(req, res) {
  try {
    await purgarDocumentos();
    return res.json({ mensaje: 'Purga completada' });
  } catch (err) {
    console.error('Error al purgar papelera:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listarPapelera, restaurarDocumento, purgarPapelera };
