const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CandidatoPerfil = sequelize.define('CandidatoPerfil', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId:  { type: DataTypes.INTEGER, allowNull: false, unique: true },

  // Datos personales
  nombre:          DataTypes.STRING(100),
  apellido:        DataTypes.STRING(100),
  celular:         DataTypes.STRING(50),
  fechaNacimiento: DataTypes.DATEONLY,
  genero:          DataTypes.STRING(50),
  paisResidencia:  DataTypes.STRING(100),
  nacionalidad:    DataTypes.STRING(100),
  jurisdiccion:    DataTypes.STRING(100),
  ciudad:          DataTypes.STRING(100),

  // Discapacidad
  discapacidadVisual:   DataTypes.STRING(150),
  condicionVisual:      DataTypes.STRING(100),
  otraDiscapacidad:     DataTypes.STRING(10),
  descripcionOtraDisc:  DataTypes.TEXT,
  tieneCud:             DataTypes.STRING(10),
  beneficioSocial:      DataTypes.STRING(150),

  // Educación
  tipoEscolaridad:  DataTypes.STRING(100),
  nivelEducativo:   DataTypes.STRING(100),
  carreraEstudios:  DataTypes.TEXT,

  // Autonomía y tecnología
  braille:                 DataTypes.STRING(10),
  autonomia:               DataTypes.TEXT,
  apoyosDesplazamiento:    DataTypes.TEXT,
  vinculoTecnologia:       DataTypes.TEXT,
  herramientasTecnologicas:DataTypes.TEXT,

  // Otros
  idiomas:              DataTypes.TEXT,
  emprendimiento:       DataTypes.TEXT,
  busquedaFormacion:    DataTypes.STRING(10),
  tipoFormacionBuscada: DataTypes.TEXT,
  busquedaEmpleo:       DataTypes.STRING(10),
  estadoLaboral: {
    type: DataTypes.ENUM('No especifica', 'En búsqueda laboral', 'Contratado', 'Freelance'),
    defaultValue: 'No especifica',
  },
  tieneTrabajoActual: {
    type: DataTypes.ENUM('Sí', 'No', 'No especifica'),
    defaultValue: 'No especifica',
  },
  areaTrabajoActual:    DataTypes.STRING(150),
  informacionAdicional: DataTypes.TEXT,

  // Consentimiento
  aceptaAutorizacion: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Observaciones del gestor
  observacionPerfil: { type: DataTypes.TEXT, allowNull: true },
  fechaObservacion:  { type: DataTypes.DATE, allowNull: true },

  estadoPerfil: {
    type: DataTypes.ENUM('Pendiente', 'Pre-aprobado', 'Aprobado'),
    defaultValue: 'Pendiente',
  },
  porcentajeCompletitud: { type: DataTypes.TINYINT.UNSIGNED, defaultValue: 0 },
}, {
  tableName: 'candidatos_perfil',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: 'fecha_actualizacion',
});

module.exports = CandidatoPerfil;
