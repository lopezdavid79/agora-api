/**
 * Migración de datos: copia usuarios existentes a la tabla usuario_roles,
 * preservando el rol actual de cada usuario como su rol activo.
 */
module.exports = {
  up: async ({ sequelize }) => {
    await sequelize.query(`
      INSERT IGNORE INTO usuario_roles (usuario_id, rol_id, activo)
      SELECT u.id, r.id, true
      FROM usuarios u
      JOIN roles r ON u.rol = r.nombre
    `);
  },

  down: async ({ sequelize }) => {
    // No revertimos por seguridad — no sabemos qué registros se crearon
    // en esta migración vs. los que ya existían.
  },
};
