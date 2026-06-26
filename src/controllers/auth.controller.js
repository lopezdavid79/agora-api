const crypto     = require('crypto');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { sequelize } = require('../config/database');
const { Usuario, CandidatoPerfil, Rol, UsuarioRol, TokenReseteo, RefreshToken } = require('../models/index');

// ── Helpers de cookies ────────────────────────────────────────
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function msFromExpiresIn(str) {
  if (!str) return 15 * 60 * 1000;
  const m = str.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!m) return 15 * 60 * 1000;
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(m[1]) * (mult[m[2]] || 60000);
}

function setTokensCookies(res, accessToken, refreshToken) {
  res.cookie('agora_at', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: msFromExpiresIn(ACCESS_TOKEN_EXPIRES_IN),
  });

  if (refreshToken) {
    res.cookie('agora_rt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_EXPIRES_IN_MS,
    });
  }
}

function clearTokensCookies(res) {
  res.clearCookie('agora_at');
  res.clearCookie('agora_rt', { path: '/api/auth' });
}

// ── Validaciones ──────────────────────────────────────────────
const validarLogin = [
  body('email').notEmpty().withMessage('Email o DNI requerido'),
  body('password').notEmpty().withMessage('La contraseña es requerida'),
];

// ── POST /api/auth/login ──────────────────────────────────────
async function login(req, res) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }

  const { email, password } = req.body;

  try {
    // 1. Buscar usuario
    const esEmail = email.includes('@');
    const where = esEmail
      ? { email: email.toLowerCase().trim() }
      : { dni: email.trim() };

    const usuario = await Usuario.findOne({
      where,
      include: [{ model: CandidatoPerfil, as: 'perfil', attributes: ['id', 'nombre', 'apellido', 'estadoPerfil'] }],
    });

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Tu cuenta está deshabilitada. Contactá al equipo de Ágora.' });
    }

    // 2. Verificar contraseña
    const passwordOk = await bcrypt.compare(password, usuario.password);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // 3. Obtener todos los roles del usuario
    const roles = await usuario.getRoles();
    const rolesNombres = roles.map(r => r.nombre);
    const rolActivo = rolesNombres[0] || usuario.rol || 'Candidato';

    // 4. Generar tokens
    const payload = {
      id:    usuario.id,
      email: usuario.email,
      rol:   rolActivo,
      roles: rolesNombres,
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshTokenRaw = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');

    await RefreshToken.create({
      usuarioId: usuario.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
      lastUsedAt: new Date(),
    });

    // 5. Actualizar último acceso
    usuario.update({ ultimoAcceso: new Date() }).catch(console.error);

    // 6. Setear cookies y responder
    setTokensCookies(res, accessToken, refreshTokenRaw);

    return res.json({
      usuario: {
        id:      usuario.id,
        email:   usuario.email,
        rol:     rolActivo,
        roles:   rolesNombres,
        nombre:  usuario.perfil?.nombre  || null,
        apellido:usuario.perfil?.apellido|| null,
        estadoPerfil: usuario.perfil?.estadoPerfil || null,
      },
    });

  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/auth/me ─────────────────────────────────────────
async function me(req, res) {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: CandidatoPerfil, as: 'perfil', attributes: ['id', 'nombre', 'apellido', 'estadoPerfil', 'porcentajeCompletitud'] }],
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(usuario);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────
async function refresh(req, res) {
  const rawToken = req.cookies?.agora_rt;
  if (!rawToken) {
    return res.status(401).json({ error: 'Refresh token requerido' });
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  try {
    const record = await RefreshToken.findOne({
      where: { tokenHash, revokedAt: null },
      include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'email', 'rol', 'activo'] }],
    });

    if (!record) {
      // Token no encontrado (ya rotado, revocado o nunca existió)
      return res.status(401).json({ error: 'Refresh token inválido' });
    }

    if (new Date() > record.expiresAt) {
      // Expirado — revocar
      await record.update({ revokedAt: new Date() });
      clearTokensCookies(res);
      return res.status(401).json({ error: 'Sesión expirada. Iniciá sesión nuevamente.' });
    }

    if (!record.usuario.activo) {
      await record.update({ revokedAt: new Date() });
      clearTokensCookies(res);
      return res.status(403).json({ error: 'Cuenta deshabilitada' });
    }

    // Obtener roles actualizados
    const usuario = await Usuario.findByPk(record.usuario.id, {
      include: [{ model: CandidatoPerfil, as: 'perfil', attributes: ['id', 'nombre', 'apellido', 'estadoPerfil'] }],
    });
    const roles = await usuario.getRoles();
    const rolesNombres = roles.map(r => r.nombre);
    const rolActivo = rolesNombres[0] || usuario.rol || 'Candidato';

    // Generar nuevos tokens (rotación)
    const payload = {
      id:    usuario.id,
      email: usuario.email,
      rol:   rolActivo,
      roles: rolesNombres,
    };

    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    // Rotación atómica: revocar viejo, crear nuevo
    await sequelize.transaction(async (t) => {
      await record.update({ revokedAt: new Date() }, { transaction: t });
      await RefreshToken.create({
        usuarioId: usuario.id,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
        lastUsedAt: new Date(),
      }, { transaction: t });
    });

    setTokensCookies(res, newAccessToken, newRefreshToken);

    return res.json({
      usuario: {
        id:      usuario.id,
        email:   usuario.email,
        rol:     rolActivo,
        roles:   rolesNombres,
        nombre:  usuario.perfil?.nombre  || null,
        apellido:usuario.perfil?.apellido|| null,
        estadoPerfil: usuario.perfil?.estadoPerfil || null,
      },
    });

  } catch (err) {
    console.error('Error en refresh:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────
async function logout(req, res) {
  try {
    const rawToken = req.cookies?.agora_rt;
    if (rawToken) {
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      // Revocar este refresh token
      await RefreshToken.update(
        { revokedAt: new Date() },
        { where: { tokenHash, revokedAt: null } },
      );
    }

    clearTokensCookies(res);
    return res.json({ mensaje: 'Sesión cerrada correctamente' });
  } catch (err) {
    console.error('Error en logout:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Validaciones de registro ──────────────────────────────────
const validarRegistro = [
  body('dni').notEmpty().withMessage('El DNI es requerido').trim(),
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[A-Z]/).withMessage('Debe contener al menos una mayúscula')
    .matches(/[0-9]/).withMessage('Debe contener al menos un número'),
  body('confirmPassword').notEmpty().withMessage('Debés confirmar la contraseña'),
];

// ── POST /api/auth/registro ───────────────────────────────────
async function registrar(req, res) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }

  const { dni, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  try {
    // Verificar DNI único
    const existeDni = await Usuario.findOne({ where: { dni: dni.trim() } });
    if (existeDni) {
      return res.status(409).json({ error: 'El DNI ya está registrado' });
    }

    // Verificar email único
    const existeEmail = await Usuario.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existeEmail) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);

    const usuario = await Usuario.create({
      dni: dni.trim(),
      email: email.toLowerCase().trim(),
      password: hash,
      rol: 'Candidato',
      activo: true,
    });

    // Crear perfil vacío asociado
    await CandidatoPerfil.create({
      usuarioId: usuario.id,
      estadoPerfil: 'Pendiente',
      porcentajeCompletitud: 0,
    });

    // Asignar rol por defecto al registrar
    const rolCandidato = await Rol.findOne({ where: { nombre: 'Candidato' } });
    if (rolCandidato) {
      await UsuarioRol.create({ usuarioId: usuario.id, rolId: rolCandidato.id, activo: true });
    }

    // Obtener todos los roles del usuario
    const roles = await usuario.getRoles();
    const rolesNombres = roles.map(r => r.nombre);
    const rolActivo = rolesNombres[0] || 'Candidato';

    // Generar tokens
    const payload = { id: usuario.id, email: usuario.email, rol: rolActivo, roles: rolesNombres };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshTokenRaw = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');

    await RefreshToken.create({
      usuarioId: usuario.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
      lastUsedAt: new Date(),
    });

    setTokensCookies(res, accessToken, refreshTokenRaw);

    return res.status(201).json({
      usuario: {
        id:    usuario.id,
        email: usuario.email,
        dni:   usuario.dni,
        rol:   rolActivo,
        roles: rolesNombres,
      },
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'El DNI o email ya están registrados' });
    }
    console.error('Error en registro:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/auth/cambiar-vista (multi-rol) ──────────────────
// NOTA: Endpoint funcional pero SIN consumidor frontend aún.
// El frontend necesita un botón "Cambiar modo" que llame a este
// endpoint con { rol: "Gestor" } o { rol: "Candidato" }.
// Cuando se implemente, el frontend debe refrescar la página
// o actualizar el contexto de auth con el nuevo rol.
async function cambiarVista(req, res) {
  try {
    const { rol } = req.body;
    if (!rol) return res.status(400).json({ error: 'El campo rol es requerido' });

    // Buscar el rol en la tabla roles
    const rolRecord = await Rol.findOne({ where: { nombre: rol } });
    if (!rolRecord) return res.status(400).json({ error: 'Rol inválido' });

    const asignacion = await UsuarioRol.findOne({
      where: { usuarioId: req.usuario.id, rolId: rolRecord.id },
    });
    if (!asignacion) return res.status(403).json({ error: 'No tenés ese rol' });

    // Desactivar rol actual, activar el nuevo
    await UsuarioRol.update({ activo: false }, { where: { usuarioId: req.usuario.id } });
    await asignacion.update({ activo: true });

    // Generar nuevo JWT con el rol cambiado
    const usuario = await Usuario.findByPk(req.usuario.id);
    const todosRoles = await usuario.getRoles();
    const payload = {
      id: usuario.id,
      email: usuario.email,
      rol: rol,
      roles: todosRoles.map(r => r.nombre),
    };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    // Solo actualizamos el access token cookie, el refresh token sigue siendo válido
    res.cookie('agora_at', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: msFromExpiresIn(ACCESS_TOKEN_EXPIRES_IN),
    });

    return res.json({ rol });
  } catch (err) {
    console.error('Error al cambiar vista:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/auth/resetear-password ──────────────────────────
async function resetearPasswordToken(req, res) {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ error: 'token, password y confirmPassword son requeridos' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const tokenRecord = await TokenReseteo.findOne({
      where: { token, usado: false },
    });

    if (!tokenRecord) {
      return res.status(404).json({ error: 'Token inválido o ya fue usado' });
    }

    if (new Date() > new Date(tokenRecord.expiraEn)) {
      return res.status(410).json({ error: 'El token ha expirado. Solicitá uno nuevo.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await Usuario.update({ password: hash }, { where: { id: tokenRecord.usuarioId } });
    await tokenRecord.update({ usado: true });

    return res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error al resetear password:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  login, me, refresh, logout, registrar,
  validarLogin, validarRegistro,
  cambiarVista, resetearPasswordToken,
};
