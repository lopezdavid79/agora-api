const { body, validationResult } = require('express-validator');
const { CandidatoPerfil, Usuario } = require('../models/index');

// ── Helper: calcular % de completitud ────────────────────────

// Todos los campos del perfil que contribuyen al % de completitud
const CAMPOS_REQUERIDOS = [
  // Datos personales
  'nombre', 'apellido', 'celular', 'fechaNacimiento', 'genero',
  'jurisdiccion', 'ciudad', 'paisResidencia', 'nacionalidad',
  // Discapacidad
  'discapacidadVisual', 'condicionVisual', 'tieneCud',
  'otraDiscapacidad', 'descripcionOtraDisc', 'beneficioSocial',
  // Educación
  'tipoEscolaridad', 'nivelEducativo', 'carreraEstudios',
  // Autonomía y tecnología
  'braille', 'autonomia', 'apoyosDesplazamiento', 'vinculoTecnologia',
  'herramientasTecnologicas', 'idiomas',
  // Empleo y formación
  'busquedaEmpleo', 'tieneTrabajoActual', 'areaTrabajoActual',
  'busquedaFormacion', 'tipoFormacionBuscada', 'emprendimiento',
  'informacionAdicional', 'aceptaAutorizacion',
];

// Campos que solo aplican cuando se cumple una condición
const CONDICIONALES = {
  descripcionOtraDisc: { dependeDe: 'otraDiscapacidad', esperado: 'Sí' },
};

function camposRelevantes(perfil) {
  return CAMPOS_REQUERIDOS.filter(campo => {
    const cond = CONDICIONALES[campo];
    if (!cond) return true;
    return perfil[cond.dependeDe] === cond.esperado;
  });
}

function campoEstaCompleto(campo, perfil) {
  const val = perfil[campo];
  return val !== null && val !== undefined && String(val).trim() !== '';
}

function calcularCompletitud(perfil) {
  const relevantes = camposRelevantes(perfil);
  if (relevantes.length === 0) return 0;
  const completados = relevantes.filter(c => campoEstaCompleto(c, perfil));
  return Math.round((completados.length / relevantes.length) * 100);
}

// ── Validaciones para editar perfil ──────────────────────────
const validarPerfil = [
  body('nombre').optional().isLength({ max: 100 }).trim(),
  body('apellido').optional().isLength({ max: 100 }).trim(),
  body('celular').optional().isLength({ max: 50 }).trim(),
  body('fechaNacimiento').optional({ nullable: true }).isDate({ format: 'YYYY-MM-DD' })
    .withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
  body('email').optional().isEmail().withMessage('Email inválido'),
];

// ── GET /api/candidatos/perfil ────────────────────────────────
async function obtenerPerfil(req, res) {
  try {
    const perfil = await CandidatoPerfil.findOne({
      where: { usuarioId: req.usuario.id },
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['email', 'dni', 'rol', 'fecha_registro'],
      }],
    });

    if (!perfil) return res.status(404).json({ error: 'Perfil no encontrado' });
    return res.json(perfil);
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/candidatos/perfil ────────────────────────────────
async function actualizarPerfil(req, res) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }

  // Campos que el candidato NO puede modificar por su cuenta
  const CAMPOS_BLOQUEADOS = ['estadoPerfil', 'usuarioId', 'porcentajeCompletitud'];
  const datos = { ...req.body };
  CAMPOS_BLOQUEADOS.forEach(c => delete datos[c]);

  try {
    const perfil = await CandidatoPerfil.findOne({ where: { usuarioId: req.usuario.id } });
    if (!perfil) return res.status(404).json({ error: 'Perfil no encontrado' });

    // Si el perfil ya fue Aprobado, solo el gestor puede modificarlo
    if (perfil.estadoPerfil === 'Aprobado') {
      return res.status(403).json({ error: 'Tu perfil ya fue aprobado. Contactá al equipo de Ágora para realizar cambios.' });
    }

    // Actualizar email en tabla usuarios si viene en el body
    if (datos.email) {
      await Usuario.update(
        { email: datos.email.toLowerCase() },
        { where: { id: req.usuario.id } }
      );
      delete datos.email;
    }

    await perfil.update(datos);

    // Recalcular completitud
    const completitud = calcularCompletitud(perfil);
    await perfil.update({ porcentajeCompletitud: completitud });

    return res.json({
      mensaje: 'Perfil actualizado correctamente',
      porcentajeCompletitud: completitud,
      perfil,
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'El email ya está en uso' });
    }
    console.error('Error al actualizar perfil:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/candidatos/perfil/completitud ────────────────────
async function obtenerCompletitud(req, res) {
  try {
    const perfil = await CandidatoPerfil.findOne({
      where: { usuarioId: req.usuario.id },
      attributes: ['porcentajeCompletitud', 'estadoPerfil', ...CAMPOS_REQUERIDOS],
    });
    if (!perfil) return res.status(404).json({ error: 'Perfil no encontrado' });

    // Detectar qué campos faltan (solo los relevantes para este perfil)
    const relevantes = camposRelevantes(perfil);
    const faltantes = relevantes.filter(c => !campoEstaCompleto(c, perfil));

    return res.json({
      porcentajeCompletitud: perfil.porcentajeCompletitud,
      estadoPerfil: perfil.estadoPerfil,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Exportamos calcularCompletitud para permitir pruebas unitarias
module.exports = { obtenerPerfil, actualizarPerfil, obtenerCompletitud, validarPerfil, calcularCompletitud, CAMPOS_REQUERIDOS, CONDICIONALES };
