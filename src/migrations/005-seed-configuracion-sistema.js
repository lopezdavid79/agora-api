/**
 * Seed: inserta las configuraciones del sistema por defecto.
 */
module.exports = {
  up: async ({ sequelize }) => {
    await sequelize.query(`
      INSERT IGNORE INTO configuracion_sistema (clave, valor, descripcion)
      VALUES
        ('tamano_maximo_archivos', '5', 'Tamaño máximo de archivos en MB'),
        ('cantidad_maxima_archivos', '10', 'Cantidad máxima de documentos por usuario')
    `);
  },

  down: async ({ sequelize }) => {
    await sequelize.query(`
      DELETE FROM configuracion_sistema
      WHERE clave IN ('tamano_maximo_archivos', 'cantidad_maxima_archivos')
    `);
  },
};
