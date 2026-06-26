const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Catalogo = sequelize.define('Catalogo', {
  id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo:   {
    type: DataTypes.ENUM(
      'pais', 'provincia', 'ciudad',
      'tipo_discapacidad', 'condicion_visual',
      'habilidad_tecnica',
      'nivel_educativo', 'carrera',
      'beneficio_social'
    ),
    allowNull: false,
  },
  nombre: { type: DataTypes.STRING(200), allowNull: false },
  activo: { type: DataTypes.BOOLEAN, defaultValue: true },
  orden:  { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'catalogos',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: 'fecha_actualizacion',
  indexes: [
    { fields: ['tipo'] },
    { fields: ['tipo', 'activo'] },
  ],
});

module.exports = Catalogo;
