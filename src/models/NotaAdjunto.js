const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NotaAdjunto = sequelize.define('NotaAdjunto', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  notaId:        { type: DataTypes.INTEGER, allowNull: false },
  nombreArchivo: { type: DataTypes.STRING(255), allowNull: false },
  rutaArchivo:   { type: DataTypes.TEXT, allowNull: false },
  tipoArchivo:   { type: DataTypes.STRING(100), allowNull: true },
  tamanoBytes:   { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'notas_adjuntos',
  timestamps: true,
  createdAt: 'fecha_subida',
  updatedAt: false,
});

module.exports = NotaAdjunto;
