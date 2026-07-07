/**
 * 007-add-rol-instructor.js
 * ==========================
 * Agrega el rol "Instructor" al sistema:
 *   - ALTER TABLE roles.nombre ENUM
 *   - INSERT del nuevo rol
 *   - ALTER TABLE usuarios.rol ENUM (columna legacy)
 */
module.exports = {
  up: async ({ queryInterface, sequelize }) => {
    // 1. Roles catalog — alter ENUM
    await sequelize.query(`
      ALTER TABLE roles
      MODIFY COLUMN nombre ENUM('Candidato','Gestor','Coordinador','GestorTecnico','Administrador','Instructor')
      NOT NULL
    `);

    // 2. Insert Instructor role
    await sequelize.query(`
      INSERT IGNORE INTO roles (nombre) VALUES ('Instructor')
    `);

    // 3. Legacy usuarios.rol — alter ENUM
    await sequelize.query(`
      ALTER TABLE usuarios
      MODIFY COLUMN rol ENUM('Candidato','Gestor','Coordinador','GestorTecnico','Administrador','Instructor')
      NOT NULL DEFAULT 'Candidato'
    `);
  },

  down: async ({ sequelize }) => {
    // Revert: remove Instructor from roles.nombre ENUM
    await sequelize.query(`
      ALTER TABLE roles
      MODIFY COLUMN nombre ENUM('Candidato','Gestor','Coordinador','GestorTecnico','Administrador')
      NOT NULL
    `);

    // Remove Instructor from usuarios.rol ENUM
    await sequelize.query(`
      ALTER TABLE usuarios
      MODIFY COLUMN rol ENUM('Candidato','Gestor','Coordinador','GestorTecnico','Administrador')
      NOT NULL DEFAULT 'Candidato'
    `);

    // Note: Instructor role rows remain in the table (referential integrity safety)
    // but can't be assigned anymore since the ENUM rejects them.
  },
};
