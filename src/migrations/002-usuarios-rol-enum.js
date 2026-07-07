/**
 * Expande el ENUM de usuarios.rol para incluir todos los roles del sistema.
 * MySQL requiere ALTER TABLE para modificar un ENUM.
 */
module.exports = {
  up: async ({ sequelize }) => {
    await sequelize.query(`
      ALTER TABLE usuarios
      MODIFY COLUMN rol ENUM('Candidato','Gestor','Coordinador','GestorTecnico','Administrador','Instructor')
      NOT NULL DEFAULT 'Candidato'
    `);
  },

  down: async ({ sequelize }) => {
    await sequelize.query(`
      ALTER TABLE usuarios
      MODIFY COLUMN rol ENUM('Candidato','Gestor','Coordinador','Administrador')
      NOT NULL DEFAULT 'Candidato'
      /* Nota: Instructor no se revierte porque no existía cuando se creó esta migración */
    `);
  },
};
