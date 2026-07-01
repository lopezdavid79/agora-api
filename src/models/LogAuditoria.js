const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LogAuditoria = sequelize.define('LogAuditoria', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId:   { type: DataTypes.INTEGER, allowNull: false },
  documentoId: { type: DataTypes.INTEGER, allowNull: true },
  accion:      { type: DataTypes.ENUM('Vista', 'Descarga', 'Subida', 'Eliminación'), allowNull: false },
  ipOrigen:    { type: DataTypes.STRING(45), allowNull: true },
  detalle:     { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'auditoria_documentos',
  timestamps: true,
  createdAt: 'fecha',
  updatedAt: false,
});

module.exports = LogAuditoria;
