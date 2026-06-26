const { Op } = require('sequelize');
const fs = require('fs');
const { Documento } = require('../models/index');

/**
 * Purga documentos con deletedAt > 30 días.
 * Se ejecuta diariamente desde server.js.
 */
async function purgarDocumentos() {
  try {
    const treintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const aPurgar = await Documento.findAll({
      where: {
        deletedAt: { [Op.ne]: null, [Op.lte]: treintaDias },
      },
    });

    for (const doc of aPurgar) {
      // Borrar archivo físico si existe
      try {
        if (doc.urlDrive && fs.existsSync(doc.urlDrive)) {
          fs.unlinkSync(doc.urlDrive);
        }
      } catch (e) {
        console.error('Error al eliminar archivo físico:', e.message);
      }
      // Borrar registro de la BD (destrucción real)
      await doc.destroy({ force: true });
    }

    if (aPurgar.length > 0) {
      console.log(`🧹 Purga automática: ${aPurgar.length} documentos eliminados definitivamente`);
    }
  } catch (err) {
    console.error('Error en purga de documentos:', err);
  }
}

module.exports = { purgarDocumentos };
