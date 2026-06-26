const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ConfiguracionSistema = sequelize.define('ConfiguracionSistema', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  clave:              { type: DataTypes.STRING(100), allowNull: false, unique: true },
  valor:             { type: DataTypes.TEXT, allowNull: false },
  descripcion:       { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'configuracion_sistema',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: 'fecha_actualizacion',
});

module.exports = ConfiguracionSistema;
