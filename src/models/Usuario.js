const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dni:      { type: DataTypes.STRING(20), allowNull: false, unique: true },
  email:    { type: DataTypes.STRING(100), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  rol:      { type: DataTypes.ENUM('Candidato', 'Gestor', 'Coordinador', 'GestorTecnico', 'Administrador', 'Instructor'), defaultValue: 'Candidato' },
  activo:   { type: DataTypes.BOOLEAN, defaultValue: true },
  ultimoAcceso: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'usuarios',
  timestamps: true,
  createdAt: 'fecha_registro',
  updatedAt: false,
});

module.exports = Usuario;
