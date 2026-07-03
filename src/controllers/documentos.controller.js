const fs   = require('fs');
const path = require('path');
const { URL } = require('url');
const { Documento, CandidatoPerfil, LogAuditoria } = require('../models/index');

// ── POST /api/documentos/subir ────────────────────────────────
async function subirDocumento(req, res) {
  try {
    // Obtener el perfil del candidato autenticado
    const perfil = await CandidatoPerfil.findOne({
      where: { usuarioId: req.usuario.id },
    });

    if (!perfil) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Debe adjuntar un archivo' });
    }

    const { tipoDocumento } = req.body;

    const documento = await Documento.create({
      perfilId:      perfil.id,
      tipoDocumento: tipoDocumento || 'Otro',
      urlDrive:      req.file.path,
      nombreArchivo: req.file.originalname,
    });

    return res.status(201).json(documento);
  } catch (err) {
    console.error('Error al subir documento:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/documentos ────────────────────────────────────────
async function listarDocumentos(req, res) {
  try {
    const where = { deletedAt: null };

    if (req.usuario.rol === 'Candidato') {
      // Solo sus propios documentos
      const perfil = await CandidatoPerfil.findOne({
        where: { usuarioId: req.usuario.id },
      });
      if (!perfil) {
        return res.status(404).json({ error: 'Perfil no encontrado' });
      }
      where.perfilId = perfil.id;
    } else if (req.query.perfilId) {
      // Gestor+ puede filtrar por perfilId
      where.perfilId = req.query.perfilId;
    }

    const documentos = await Documento.findAll({ where });
    return res.json(documentos);
  } catch (err) {
    console.error('Error al listar documentos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── DELETE /api/documentos/:id ─────────────────────────────────
async function eliminarDocumento(req, res) {
  try {
    const documento = await Documento.findByPk(req.params.id);

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Verificar permisos
    if (req.usuario.rol === 'Candidato') {
      const perfil = await CandidatoPerfil.findOne({
        where: { usuarioId: req.usuario.id },
      });
      if (!perfil || documento.perfilId !== perfil.id) {
        return res.status(403).json({ error: 'No tenés permiso para eliminar este documento' });
      }
    }

    // Soft delete
    await documento.update({ deletedAt: new Date() });

    return res.json({ mensaje: 'Documento eliminado. Estará en la papelera por 30 días.' });
  } catch (err) {
    console.error('Error al eliminar documento:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/documentos/:id/descargar ──────────────────────────
async function descargarDocumento(req, res) {
  try {
    const documento = await Documento.findOne({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Verificar permisos
    if (req.usuario.rol === 'Candidato') {
      const perfil = await CandidatoPerfil.findOne({
        where: { usuarioId: req.usuario.id },
      });
      if (!perfil || documento.perfilId !== perfil.id) {
        return res.status(403).json({ error: 'No tenés permiso para descargar este documento' });
      }
    } else {
      // Auditoría para Gestores+
      try {
        await LogAuditoria.create({
          usuarioId: req.usuario.id,
          documentoId: documento.id,
          accion: 'Vista',
          ipOrigen: req.ip || req.connection?.remoteAddress || null,
          detalle: `Gestor visualizó documento del perfil ${documento.perfilId}`,
        });
      } catch (errAud) {
        console.error('Error al registrar auditoría:', errAud);
        // No interrumpir la descarga por un error de auditoría
      }
    }

    // Detectar si urlDrive es URL externa o ruta local
    const esUrlExterna = String(documento.urlDrive).startsWith('http');

    if (esUrlExterna) {
      // Documento de Drive — redirigir a la URL original
      return res.redirect(302, documento.urlDrive);
    }

    // Documento local — verificar que exista en disco y enviarlo
    if (!fs.existsSync(documento.urlDrive)) {
      return res.status(404).json({ error: 'El archivo no existe en el servidor' });
    }

    return res.sendFile(path.resolve(documento.urlDrive));
  } catch (err) {
    console.error('Error al descargar documento:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { subirDocumento, listarDocumentos, eliminarDocumento, descargarDocumento };
