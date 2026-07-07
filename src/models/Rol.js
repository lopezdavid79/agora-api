const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Rol = sequelize.define('Rol', {
  id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: {
    type: DataTypes.ENUM('Candidato', 'Gestor', 'Coordinador', 'GestorTecnico', 'Administrador', 'Instructor'),
    allowNull: false,
    unique: true,
  },
}, {
  tableName: 'roles',
  timestamps: false,
});

module.exports = Rol;
