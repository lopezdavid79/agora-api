const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PreferenciaUsuario = sequelize.define('PreferenciaUsuario', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId:       { type: DataTypes.INTEGER, allowNull: false, unique: true },
  modoOscuro:      { type: DataTypes.BOOLEAN, defaultValue: false },
  tamanoFuente:    { type: DataTypes.ENUM('normal', 'grande', 'muy_grande'), defaultValue: 'normal' },
  altoContraste:   { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'preferencias_usuario',
  timestamps: true,
  createdAt: false,
  updatedAt: 'fecha_actualizacion',
});

module.exports = PreferenciaUsuario;
