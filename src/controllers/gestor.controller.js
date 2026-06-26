const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const {
  CandidatoPerfil,
  Usuario,
  Documento,
  NotaInterna,
  NotaAdjunto,
  TokenReseteo,
  Notificacion,
} = require('../models/index');
const { calcularCompletitud } = require('./candidatos.controller');

// ── Helpers ────────────────────────────────────────────────────

const FILTER_ALLOWLIST = [
  'nombre', 'apellido', 'celular', 'genero',
  'paisResidencia', 'nacionalidad', 'jurisdiccion', 'ciudad',
  'discapacidadVisual', 'condicionVisual', 'otraDiscapacidad',
  'tieneCud', 'beneficioSocial',
  'tipoEscolaridad', 'nivelEducativo', 'carreraEstudios',
  'braille', 'autonomia', 'vinculoTecnologia', 'herramientasTecnologicas',
  'idiomas', 'busquedaFormacion', 'tipoFormacionBuscada',
  'busquedaEmpleo', 'tieneTrabajoActual', 'areaTrabajoActual',
  'estadoPerfil',
];

const EXCLUDE_FILTER_FIELDS = ['modo', 'page', 'limit'];

function construirFiltros(query, modo) {
  const filtros = {};
  for (const [key, value] of Object.entries(query)) {
    if (!EXCLUDE_FILTER_FIELDS.includes(key) && FILTER_ALLOWLIST.includes(key) && value) {
      // Escapar wildcards LIKE para que % y _ sean literales
      const escaped = String(value).replace(/[%_]/g, '\\$&');
      filtros[key] = { [Op.like]: `%${escaped}%` };
    }
  }

  if (modo === 'OR' && Object.keys(filtros).length > 0) {
    return {
      [Op.or]: Object.entries(filtros).map(([campo, condicion]) => ({
        [campo]: condicion,
      })),
    };
  }

  return filtros; // AND por defecto
}

// ── GET /api/gestor/candidatos/buscar ──────────────────────────
async function buscarCandidatos(req, res) {
  try {
    const modo = req.query.modo || 'AND';
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const where = construirFiltros(req.query, modo);

    const { count, rows } = await CandidatoPerfil.findAndCountAll({
      where,
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['email', 'dni'],
        },
        {
          model: Documento,
          as: 'documentos',
          where: { deletedAt: null },
          required: false,
        },
      ],
      offset,
      limit,
      distinct: true,
      order: [['fecha_actualizacion', 'DESC']],
    });

    return res.json({
      candidatos: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error('Error al buscar candidatos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/gestor/candidatos/exportar ────────────────────────
async function exportarExcel(req, res) {
  try {
    const modo = req.query.modo || 'AND';
    const where = construirFiltros(req.query, modo);

    const candidatos = await CandidatoPerfil.findAll({
      where,
      limit: 10000,
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['email', 'dni'],
        },
        {
          model: Documento,
          as: 'documentos',
          where: { deletedAt: null },
          required: false,
        },
      ],
      order: [['fecha_actualizacion', 'DESC']],
    });

    // Armar workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Candidatos');

    sheet.columns = [
      { header: 'Nombre',            key: 'nombre',            width: 25 },
      { header: 'Apellido',          key: 'apellido',          width: 25 },
      { header: 'DNI',               key: 'dni',               width: 15 },
      { header: 'Email',             key: 'email',             width: 30 },
      { header: 'Celular',           key: 'celular',           width: 18 },
      { header: 'Ciudad',            key: 'ciudad',            width: 20 },
      { header: 'Jurisdicción',      key: 'jurisdiccion',      width: 20 },
      { header: 'Nivel Educativo',   key: 'nivelEducativo',    width: 20 },
      { header: 'Discapacidad Visual', key: 'discapacidadVisual', width: 20 },
      { header: 'Estado del Perfil', key: 'estadoPerfil',      width: 18 },
      { header: '% Completitud',     key: 'porcentajeCompletitud', width: 14 },
      { header: 'Ver DNI',           key: 'linkDni',           width: 35 },
      { header: 'Ver CUD',           key: 'linkCud',           width: 35 },
      { header: 'Ver CV',            key: 'linkCv',            width: 35 },
    ];

    candidatos.forEach((c) => {
      const perfil = c.get({ plain: true });

      const linkDni = (perfil.documentos || []).find(
        (d) => d.tipoDocumento === 'DNI'
      );
      const linkCud = (perfil.documentos || []).find(
        (d) => d.tipoDocumento === 'CUD'
      );
      const linkCv = (perfil.documentos || []).find(
        (d) => d.tipoDocumento === 'CV'
      );

      sheet.addRow({
        nombre:               perfil.nombre || '',
        apellido:             perfil.apellido || '',
        dni:                  perfil.usuario?.dni || '',
        email:                perfil.usuario?.email || '',
        celular:              perfil.celular || '',
        ciudad:               perfil.ciudad || '',
        jurisdiccion:         perfil.jurisdiccion || '',
        nivelEducativo:       perfil.nivelEducativo || '',
        discapacidadVisual:   perfil.discapacidadVisual || '',
        estadoPerfil:         perfil.estadoPerfil || '',
        porcentajeCompletitud: perfil.porcentajeCompletitud ?? 0,
        linkDni:              linkDni ? `/api/documentos/${linkDni.id}/descargar` : '',
        linkCud:              linkCud ? `/api/documentos/${linkCud.id}/descargar` : '',
        linkCv:               linkCv ? `/api/documentos/${linkCv.id}/descargar` : '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="candidatos.xlsx"'
    );
    return res.send(buffer);
  } catch (err) {
    console.error('Error al exportar Excel:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/gestor/candidatos/:id ─────────────────────────────
async function fichaCandidato(req, res) {
  try {
    const { id } = req.params;

    const perfil = await CandidatoPerfil.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['email', 'dni', 'rol', 'activo', 'fecha_registro'],
        },
        {
          model: Documento,
          as: 'documentos',
          where: { deletedAt: null },
          required: false,
        },
        {
          model: NotaInterna,
          as: 'notas',
          separate: true,
          order: [['fecha_creacion', 'DESC']],
          include: [
            {
              model: Usuario,
              as: 'gestor',
              attributes: ['id', 'email'],
            },
            {
              model: NotaAdjunto,
              as: 'adjuntos',
              attributes: ['id', 'nombreArchivo', 'tipoArchivo', 'tamanoBytes', 'fecha_subida'],
              required: false,
            },
          ],
        },
      ],
    });

    if (!perfil) {
      return res.status(404).json({ error: 'Candidato no encontrado' });
    }

    // Últimas 5 notificaciones del candidato
    const notificaciones = await Notificacion.findAll({
      where: { usuarioId: perfil.usuarioId },
      order: [['fecha_envio', 'DESC']],
      limit: 5,
    });

    const resultado = perfil.get({ plain: true });
    resultado.notificaciones = notificaciones;

    return res.json(resultado);
  } catch (err) {
    console.error('Error al obtener ficha del candidato:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/gestor/candidatos/:id/estado ──────────────────────
async function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const ESTADOS_PERMITIDOS = ['Pendiente', 'Pre-aprobado', 'Aprobado'];
    if (!ESTADOS_PERMITIDOS.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_PERMITIDOS.join(', ')}`,
      });
    }

    const perfil = await CandidatoPerfil.findByPk(id);
    if (!perfil) {
      return res.status(404).json({ error: 'Candidato no encontrado' });
    }

    await perfil.update({ estadoPerfil: estado });

    // Recalcular porcentaje de completitud
    const completitud = calcularCompletitud(perfil);
    await perfil.update({ porcentajeCompletitud: completitud });

    return res.json(perfil);
  } catch (err) {
    console.error('Error al cambiar estado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/gestor/candidatos/:id/observacion ────────────────
async function marcarObservacion(req, res) {
  try {
    const { id } = req.params;
    const { observacion } = req.body;

    const perfil = await CandidatoPerfil.findByPk(id);
    if (!perfil) {
      return res.status(404).json({ error: 'Candidato no encontrado' });
    }

    const updateData = {};

    if (observacion && String(observacion).trim() !== '') {
      updateData.observacionPerfil = String(observacion).trim();
      updateData.fechaObservacion = new Date();
    } else {
      // Limpiar la alerta
      updateData.observacionPerfil = null;
      updateData.fechaObservacion = null;
    }

    await perfil.update(updateData);

    return res.json(perfil);
  } catch (err) {
    console.error('Error al marcar observación:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/gestor/usuarios/:id/resetear-password ──────────
async function resetearPassword(req, res) {
  try {
    const { id } = req.params;
    const crypto = require('crypto');

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Generar token único de 32 bytes → hex
    const token = crypto.randomBytes(32).toString('hex');
    const expiraEn = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await TokenReseteo.create({
      usuarioId: parseInt(id, 10),
      token,
      expiraEn,
      creadoPor: req.usuario.id,
    });

    return res.json({
      mensaje: 'Token de reseteo generado correctamente',
      token, // En producción se enviaría por email; por ahora se devuelve
      expiraEn,
    });
  } catch (err) {
    console.error('Error al generar token de reseteo:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  buscarCandidatos,
  exportarExcel,
  fichaCandidato,
  cambiarEstado,
  marcarObservacion,
  resetearPassword,
};
