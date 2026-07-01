const { DataTypes } = require('sequelize');

/**
 * Agrega columnas extra a candidatos_perfil que no están definidas
 * en el modelo CandidatoPerfil pero existen en la BD.
 */
module.exports = {
  up: async ({ queryInterface }) => {
    const tableInfo = await queryInterface.describeTable('candidatos_perfil');

    const columnsToAdd = [
      { name: 'observacion_perfil', type: DataTypes.TEXT, after: 'informacion_adicional' },
      { name: 'fecha_observacion', type: DataTypes.DATE, after: 'observacion_perfil' },
      { name: 'acepta_autorizacion', type: DataTypes.BOOLEAN, defaultValue: false, after: 'fecha_observacion' },
      {
        name: 'estado_laboral',
        type: DataTypes.ENUM('No especifica', 'En búsqueda laboral', 'Contratado', 'Freelance'),
        defaultValue: 'No especifica',
        after: 'busqueda_empleo',
      },
    ];

    for (const col of columnsToAdd) {
      if (!tableInfo[col.name]) {
        const options = { type: col.type };
        if (col.defaultValue !== undefined) options.defaultValue = col.defaultValue;
        // queryInterface.addColumn ignores `after` for simplicity, use raw query if order matters
        await queryInterface.addColumn('candidatos_perfil', col.name, options);
      }
    }
  },

  down: async ({ queryInterface }) => {
    const cols = ['estado_laboral', 'acepta_autorizacion', 'fecha_observacion', 'observacion_perfil'];
    for (const col of cols) {
      try {
        await queryInterface.removeColumn('candidatos_perfil', col);
      } catch { /* column may not exist */ }
    }
  },
};
