const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UsuarioRol = sequelize.define('UsuarioRol', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false },
  rolId:     { type: DataTypes.INTEGER, allowNull: false },
  activo:    { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'usuario_roles',
  timestamps: true,
  createdAt: 'fecha_asignacion',
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['usuario_id', 'rol_id'] },
  ],
});

module.exports = UsuarioRol;
