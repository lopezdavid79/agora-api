const { Op } = require('sequelize');
const { RefreshToken } = require('../models/index');

/**
 * Limpia refresh tokens expirados o revocados con más de 7 días de antigüedad.
 * Se ejecuta diariamente desde server.js.
 */
async function limpiarRefreshTokens() {
  try {
    const corte = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 días atrás

    const { length } = await RefreshToken.destroy({
      where: {
        [Op.or]: [
          { expiresAt: { [Op.lte]: new Date() } },           // expirados
          { revokedAt: { [Op.ne]: null, [Op.lte]: corte } }, // revocados hace > 7 días
        ],
      },
    });

    if (length > 0) {
      console.log(`🧹 Limpieza de refresh tokens: ${length} registros eliminados`);
    }
  } catch (err) {
    console.error('Error en limpieza de refresh tokens:', err);
  }
}

module.exports = { limpiarRefreshTokens };
