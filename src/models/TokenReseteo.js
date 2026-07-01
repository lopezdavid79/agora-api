const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TokenReseteo = sequelize.define('TokenReseteo', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false },
  token:     { type: DataTypes.STRING(255), allowNull: false, unique: true },
  usado:     { type: DataTypes.BOOLEAN, defaultValue: false },
  expiraEn:  { type: DataTypes.DATE, allowNull: false },
  creadoPor: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'tokens_reseteo',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: false,
});

module.exports = TokenReseteo;
