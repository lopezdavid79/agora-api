const {
  CandidatoPerfil,
  NotaInterna,
  NotaHistorial,
  Usuario,
} = require('../models/index');

// ── POST /api/gestor/candidatos/:id/notas ──────────────────────
async function crearNota(req, res) {
  try {
    const { id } = req.params;
    const { contenido } = req.body;

    if (!contenido || String(contenido).trim() === '') {
      return res.status(400).json({ error: 'El contenido de la nota no puede estar vacío' });
    }

    // Verificar que el perfil existe
    const perfil = await CandidatoPerfil.findByPk(id);
    if (!perfil) {
      return res.status(404).json({ error: 'Candidato no encontrado' });
    }

    const nota = await NotaInterna.create({
      perfilId: parseInt(id, 10),
      gestorId: req.usuario.id,
      contenido: String(contenido).trim(),
    });

    return res.status(201).json(nota);
  } catch (err) {
    console.error('Error al crear nota:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/gestor/candidatos/:id/notas ───────────────────────
async function listarNotas(req, res) {
  try {
    const { id } = req.params;

    // Verificar que el perfil existe
    const perfil = await CandidatoPerfil.findByPk(id);
    if (!perfil) {
      return res.status(404).json({ error: 'Candidato no encontrado' });
    }

    const notas = await NotaInterna.findAll({
      where: { perfilId: id },
      order: [['fecha_creacion', 'DESC']],
      include: [
        {
          model: Usuario,
          as: 'gestor',
          attributes: ['id', 'email'],
        },
      ],
    });

    return res.json(notas);
  } catch (err) {
    console.error('Error al listar notas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/gestor/candidatos/:id/notas/:nid ──────────────────
async function editarNota(req, res) {
  try {
    const { id, nid } = req.params;
    const { contenido } = req.body;

    if (!contenido || String(contenido).trim() === '') {
      return res.status(400).json({ error: 'El contenido de la nota no puede estar vacío' });
    }

    const nota = await NotaInterna.findByPk(nid);

    if (!nota) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    if (nota.perfilId !== parseInt(id, 10)) {
      return res.status(400).json({ error: 'La nota no pertenece al candidato indicado' });
    }

    // Solo el autor o un Administrador puede editar la nota
    if (nota.gestorId !== req.usuario.id && req.usuario.rol !== 'Administrador') {
      return res.status(403).json({ error: 'No tenés permiso para editar esta nota' });
    }

    // Guardar versión anterior en el historial
    await NotaHistorial.create({
      notaId: nota.id,
      contenidoAnterior: nota.contenido,
      editadoPor: req.usuario.id,
    });

    await nota.update({
      contenido: String(contenido).trim(),
      fechaEdicion: new Date(),
    });

    return res.json(nota);
  } catch (err) {
    console.error('Error al editar nota:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/gestor/candidatos/:id/notas/:nid/historial ────────
async function historialNota(req, res) {
  try {
    const { id, nid } = req.params;

    const nota = await NotaInterna.findOne({
      where: { id: nid, perfilId: id },
    });
    if (!nota) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    const historial = await NotaHistorial.findAll({
      where: { notaId: nid },
      order: [['fecha_edicion', 'DESC']],
      include: [{
        model: Usuario,
        as: 'editor',
        attributes: ['id', 'email'],
      }],
    });

    return res.json(historial);
  } catch (err) {
    console.error('Error al obtener historial:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  crearNota,
  listarNotas,
  editarNota,
  historialNota,
};
