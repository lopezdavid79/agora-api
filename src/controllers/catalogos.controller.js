const { Op } = require('sequelize');
const { Catalogo, CandidatoPerfil } = require('../models/index');

// ── Mapeo de tipo de catálogo → campos de CandidatoPerfil ─────
const CAMPOS_POR_TIPO = {
  pais:               ['paisResidencia', 'nacionalidad', 'jurisdiccion', 'ciudad'],
  provincia:          ['paisResidencia', 'nacionalidad', 'jurisdiccion', 'ciudad'],
  ciudad:             ['ciudad'],
  tipo_discapacidad:  ['discapacidadVisual'],
  condicion_visual:   ['condicionVisual'],
  nivel_educativo:    ['nivelEducativo'],
  carrera:            ['carreraEstudios'],
  habilidad_tecnica:  ['herramientasTecnologicas'],
  beneficio_social:   ['beneficioSocial'],
};

const TIPOS_PERMITIDOS = Object.keys(CAMPOS_POR_TIPO);

// ── GET /api/catalogos ─────────────────────────────────────────
async function listarCatalogos(req, res) {
  try {
    const { tipo, incluirInactivos } = req.query;

    if (!tipo) {
      return res.status(400).json({ error: 'El parámetro "tipo" es requerido.' });
    }

    const where = { tipo };

    if (incluirInactivos !== 'true') {
      where.activo = true;
    }

    const catalogos = await Catalogo.findAll({
      where,
      order: [
        ['orden', 'ASC'],
        ['nombre', 'ASC'],
      ],
    });

    return res.json(catalogos);
  } catch (err) {
    console.error('Error al listar catálogos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/catalogos ────────────────────────────────────────
async function crearCatalogo(req, res) {
  try {
    const { tipo, nombre, orden } = req.body;

    if (!tipo || !TIPOS_PERMITIDOS.includes(tipo)) {
      return res.status(400).json({
        error: `El tipo debe ser uno de: ${TIPOS_PERMITIDOS.join(', ')}.`,
      });
    }

    if (!nombre || String(nombre).trim() === '') {
      return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
    }

    const catalogo = await Catalogo.create({
      tipo,
      nombre: String(nombre).trim(),
      orden: orden !== undefined ? orden : 0,
    });

    return res.status(201).json(catalogo);
  } catch (err) {
    console.error('Error al crear catálogo:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/catalogos/:id ─────────────────────────────────────
async function actualizarCatalogo(req, res) {
  try {
    const catalogo = await Catalogo.findByPk(req.params.id);

    if (!catalogo) {
      return res.status(404).json({ error: 'Catálogo no encontrado.' });
    }

    const datos = { ...req.body };

    // NO permitir cambiar el tipo
    delete datos.tipo;

    if (datos.nombre !== undefined && String(datos.nombre).trim() === '') {
      return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
    }

    await catalogo.update(datos);

    return res.json(catalogo);
  } catch (err) {
    console.error('Error al actualizar catálogo:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── DELETE /api/catalogos/:id ──────────────────────────────────
async function eliminarCatalogo(req, res) {
  try {
    const catalogo = await Catalogo.findByPk(req.params.id);

    if (!catalogo) {
      return res.status(404).json({ error: 'Catálogo no encontrado.' });
    }

    const campos = CAMPOS_POR_TIPO[catalogo.tipo];

    if (campos) {
      const cantidad = await CandidatoPerfil.count({
        where: {
          [Op.or]: campos.map(c => ({ [c]: catalogo.nombre })),
        },
      });

      if (cantidad > 0) {
        return res.status(409).json({
          error: `No se puede eliminar. ${cantidad} perfil(es) usan este valor.`,
          sugerencia: 'Usá deshabilitar en su lugar.',
          cantidadPerfiles: cantidad,
        });
      }
    }

    await catalogo.destroy();
    return res.status(204).end();
  } catch (err) {
    console.error('Error al eliminar catálogo:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/catalogos/:id/deshabilitar ───────────────────────
async function deshabilitarCatalogo(req, res) {
  try {
    const catalogo = await Catalogo.findByPk(req.params.id);

    if (!catalogo) {
      return res.status(404).json({ error: 'Catálogo no encontrado.' });
    }

    await catalogo.update({ activo: false });

    return res.json(catalogo);
  } catch (err) {
    console.error('Error al deshabilitar catálogo:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/catalogos/:id/usuarios-afectados ─────────────────
async function usuariosAfectados(req, res) {
  try {
    const catalogo = await Catalogo.findByPk(req.params.id);

    if (!catalogo) {
      return res.status(404).json({ error: 'Catálogo no encontrado.' });
    }

    const campos = CAMPOS_POR_TIPO[catalogo.tipo];

    if (!campos) {
      return res.json({ cantidad: 0, perfiles: [] });
    }

    const perfiles = await CandidatoPerfil.findAll({
      where: {
        [Op.or]: campos.map(c => ({ [c]: catalogo.nombre })),
      },
      attributes: ['id', 'nombre', 'apellido'],
    });

    return res.json({ cantidad: perfiles.length, perfiles });
  } catch (err) {
    console.error('Error al consultar usuarios afectados:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  listarCatalogos,
  crearCatalogo,
  actualizarCatalogo,
  eliminarCatalogo,
  deshabilitarCatalogo,
  usuariosAfectados,
};
