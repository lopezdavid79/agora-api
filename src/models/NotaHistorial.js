const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NotaHistorial = sequelize.define('NotaHistorial', {
  id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  notaId:            { type: DataTypes.INTEGER, allowNull: false },
  contenidoAnterior: { type: DataTypes.TEXT, allowNull: false },
  editadoPor:        { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'notas_historial',
  timestamps: true,
  createdAt: 'fecha_edicion',
  updatedAt: false,
});

module.exports = NotaHistorial;
