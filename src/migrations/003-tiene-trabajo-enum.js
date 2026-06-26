/**
 * Expande el ENUM de candidatos_perfil.tiene_trabajo_actual.
 */
module.exports = {
  up: async ({ sequelize }) => {
    await sequelize.query(`
      ALTER TABLE candidatos_perfil
      MODIFY COLUMN tiene_trabajo_actual ENUM('Sí','No','No especifica')
      NOT NULL DEFAULT 'No especifica'
    `);
  },

  down: async ({ sequelize }) => {
    await sequelize.query(`
      ALTER TABLE candidatos_perfil
      MODIFY COLUMN tiene_trabajo_actual ENUM('Sí','No')
      NOT NULL DEFAULT 'No especifica'
    `);
  },
};
