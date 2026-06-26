const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AlertaTecnica = sequelize.define('AlertaTecnica', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo:      { type: DataTypes.ENUM('error', 'warning', 'info'), defaultValue: 'info' },
  modulo:    { type: DataTypes.STRING(100), allowNull: false },
  mensaje:   { type: DataTypes.TEXT, allowNull: false },
  leida:     { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'alertas_tecnicas',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: false,
});

module.exports = AlertaTecnica;
