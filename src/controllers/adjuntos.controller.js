const fs = require('fs');
const path = require('path');
const {
  NotaInterna,
  NotaAdjunto,
} = require('../models/index');

// ── POST /api/gestor/candidatos/:id/notas/:nid/adjuntos ─────
async function subirAdjunto(req, res) {
  try {
    const { id, nid } = req.params;

    const nota = await NotaInterna.findOne({
      where: { id: nid, perfilId: id },
    });
    if (!nota) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Debe adjuntar un archivo' });
    }

    const adjunto = await NotaAdjunto.create({
      notaId: parseInt(nid, 10),
      nombreArchivo: req.file.originalname,
      rutaArchivo: req.file.path,
      tipoArchivo: req.file.mimetype,
      tamanoBytes: req.file.size,
    });

    return res.status(201).json(adjunto);
  } catch (err) {
    console.error('Error al subir adjunto:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/gestor/candidatos/:id/notas/:nid/adjuntos ──────
async function listarAdjuntos(req, res) {
  try {
    const { id, nid } = req.params;

    const nota = await NotaInterna.findOne({
      where: { id: nid, perfilId: id },
    });
    if (!nota) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    const adjuntos = await NotaAdjunto.findAll({
      where: { notaId: nid },
      attributes: ['id', 'nombreArchivo', 'tipoArchivo', 'tamanoBytes', 'fecha_subida'],
    });

    return res.json(adjuntos);
  } catch (err) {
    console.error('Error al listar adjuntos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/gestor/candidatos/:id/notas/:nid/adjuntos/:aid ─
async function descargarAdjunto(req, res) {
  try {
    const { id, nid, aid } = req.params;

    const nota = await NotaInterna.findOne({
      where: { id: nid, perfilId: id },
    });
    if (!nota) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    const adjunto = await NotaAdjunto.findOne({
      where: { id: aid, notaId: nid },
    });
    if (!adjunto) {
      return res.status(404).json({ error: 'Adjunto no encontrado' });
    }

    if (!fs.existsSync(adjunto.rutaArchivo)) {
      return res.status(404).json({ error: 'El archivo no existe en el servidor' });
    }

    return res.sendFile(path.resolve(adjunto.rutaArchivo));
  } catch (err) {
    console.error('Error al descargar adjunto:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── DELETE /api/gestor/candidatos/:id/notas/:nid/adjuntos/:aid
async function eliminarAdjunto(req, res) {
  try {
    const { id, nid, aid } = req.params;

    const nota = await NotaInterna.findOne({
      where: { id: nid, perfilId: id },
    });
    if (!nota) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    const adjunto = await NotaAdjunto.findOne({
      where: { id: aid, notaId: nid },
    });
    if (!adjunto) {
      return res.status(404).json({ error: 'Adjunto no encontrado' });
    }

    // Borrar archivo físico
    try { fs.unlinkSync(adjunto.rutaArchivo); } catch (e) {}

    await adjunto.destroy();

    return res.json({ mensaje: 'Adjunto eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar adjunto:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  subirAdjunto,
  listarAdjuntos,
  descargarAdjunto,
  eliminarAdjunto,
};
