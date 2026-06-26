/**
 * Seed: inserta los roles del sistema si no existen.
 */
module.exports = {
  up: async ({ sequelize }) => {
    await sequelize.query(`
      INSERT IGNORE INTO roles (nombre)
      VALUES ('Candidato'), ('Gestor'), ('Coordinador'), ('GestorTecnico'), ('Administrador')
    `);
  },

  down: async ({ sequelize }) => {
    // No eliminamos roles en down por seguridad — podrían estar referenciados
    // por usuario_roles. Esta migración down es un no-op intencional.
  },
};
