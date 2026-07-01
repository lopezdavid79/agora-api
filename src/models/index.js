const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Usuario        = require('./Usuario');
const NotaAdjunto    = require('./NotaAdjunto');
const NotaHistorial  = require('./NotaHistorial');
const CandidatoPerfil = require('./CandidatoPerfil');
const Rol = require('./Rol');
const UsuarioRol = require('./UsuarioRol');
const ConfiguracionSistema = require('./ConfiguracionSistema');
const AlertaTecnica = require('./AlertaTecnica');
const TokenReseteo = require('./TokenReseteo');
const RefreshToken = require('./RefreshToken');

// ── Documento ────────────────────────────────────────────────
const Documento = sequelize.define('Documento', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  perfilId:      { type: DataTypes.INTEGER, allowNull: false },
  tipoDocumento: { type: DataTypes.ENUM('CV', 'DNI', 'CUD', 'Otro'), defaultValue: 'Otro' },
  urlDrive:      { type: DataTypes.TEXT, allowNull: false },
  nombreArchivo: DataTypes.STRING(255),
  deletedAt:     { type: DataTypes.DATE, allowNull: true, defaultValue: null },
}, {
  tableName: 'documentos',
  timestamps: true,
  createdAt: 'fecha_subida',
  updatedAt: false,
});

// ── Notificacion ─────────────────────────────────────────────
const Notificacion = sequelize.define('Notificacion', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId:    { type: DataTypes.INTEGER, allowNull: false },
  emisorId:     { type: DataTypes.INTEGER, allowNull: true },
  asunto:       { type: DataTypes.STRING(255), allowNull: false },
  mensaje:      { type: DataTypes.TEXT, allowNull: false },
  leida:        { type: DataTypes.BOOLEAN, defaultValue: false },
  fechaLectura: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'notificaciones',
  timestamps: true,
  createdAt: 'fecha_envio',
  updatedAt: false,
});

// ── NotaInterna ───────────────────────────────────────────────
const NotaInterna = sequelize.define('NotaInterna', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  perfilId:     { type: DataTypes.INTEGER, allowNull: false },
  gestorId:     { type: DataTypes.INTEGER, allowNull: false },
  contenido:    { type: DataTypes.TEXT, allowNull: false },
  fechaEdicion: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'notas_internas',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: false,
});

// ── Asociaciones ──────────────────────────────────────────────
Usuario.hasOne(CandidatoPerfil, { foreignKey: 'usuarioId', as: 'perfil' });
CandidatoPerfil.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

CandidatoPerfil.hasMany(Documento,   { foreignKey: 'perfilId',  as: 'documentos' });
Documento.belongsTo(CandidatoPerfil, { foreignKey: 'perfilId',  as: 'perfil' });

Usuario.hasMany(Notificacion, { foreignKey: 'usuarioId', as: 'notificaciones' });
Notificacion.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'destinatario' });

CandidatoPerfil.hasMany(NotaInterna, { foreignKey: 'perfilId', as: 'notas' });
NotaInterna.belongsTo(CandidatoPerfil, { foreignKey: 'perfilId', as: 'perfil' });
NotaInterna.belongsTo(Usuario, { foreignKey: 'gestorId', as: 'gestor' });

// Adjuntos de notas
NotaInterna.hasMany(NotaAdjunto, { foreignKey: 'notaId', as: 'adjuntos' });
NotaAdjunto.belongsTo(NotaInterna, { foreignKey: 'notaId', as: 'nota' });

// Historial de notas
NotaInterna.hasMany(NotaHistorial, { foreignKey: 'notaId', as: 'historial' });
NotaHistorial.belongsTo(NotaInterna, { foreignKey: 'notaId', as: 'nota' });
NotaHistorial.belongsTo(Usuario, { foreignKey: 'editadoPor', as: 'editor' });

// ── Catalogo ────────────────────────────────────────────────────
const PreferenciaUsuario = require('./PreferenciaUsuario');
const LogAuditoria = require('./LogAuditoria');
const Catalogo = require('./Catalogo');

// ── Preferencias de usuario (1:1) ─────────────────────────────
Usuario.hasOne(PreferenciaUsuario, { foreignKey: 'usuarioId', as: 'preferencias' });
PreferenciaUsuario.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

// ── Auditoría de documentos ────────────────────────────────────
LogAuditoria.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
LogAuditoria.belongsTo(Documento, { foreignKey: 'documentoId', as: 'documento' });

// Multi-rol M:N
Rol.belongsToMany(Usuario, { through: UsuarioRol, foreignKey: 'rolId', otherKey: 'usuarioId', as: 'usuarios' });
Usuario.belongsToMany(Rol, { through: UsuarioRol, foreignKey: 'usuarioId', otherKey: 'rolId', as: 'roles' });
UsuarioRol.belongsTo(Rol, { foreignKey: 'rolId', as: 'rol' });
UsuarioRol.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

// Token de reseteo
TokenReseteo.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
TokenReseteo.belongsTo(Usuario, { foreignKey: 'creadoPor', as: 'creador' });

// Refresh tokens para sesiones persistentes
RefreshToken.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
Usuario.hasMany(RefreshToken, { foreignKey: 'usuarioId', as: 'refreshTokens' });

module.exports = { Usuario, CandidatoPerfil, Documento, Notificacion, NotaInterna, NotaAdjunto, NotaHistorial, Catalogo, PreferenciaUsuario, LogAuditoria, Rol, UsuarioRol, ConfiguracionSistema, AlertaTecnica, TokenReseteo, RefreshToken };
