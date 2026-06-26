require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./config/database');
const umzug = require('./config/umzug');
const cron = require('node-cron');
const { purgarDocumentos } = require('./jobs/purga-documentos');
const { limpiarRefreshTokens } = require('./jobs/limpiar-refresh-tokens');

const PORT = process.env.PORT || 3000;

async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');

    // Crea tablas de modelos si no existen
    await sequelize.sync({ force: false });
    console.log('✅ Modelos sincronizados');

    // Migraciones versionadas con umzug (columnas extra, seeds, data migration)
    const pendientes = await umzug.pending();
    if (pendientes.length > 0) {
      console.log(`📦 Ejecutando ${pendientes.length} migración(es) pendiente(s)...`);
      await umzug.up();
      console.log('✅ Migraciones ejecutadas');
    } else {
      console.log('✅ Sin migraciones pendientes');
    }

    // Programar purga automática: todos los días a las 3:00 AM
    try {
      cron.schedule('0 3 * * *', () => {
        purgarDocumentos();
      });
      console.log('⏰ Purga de documentos programada (3:00 AM)');
    } catch (err) {
      console.error('Error al programar purga:', err.message);
    }

    // Limpieza de refresh tokens expirados: todos los días a las 3:30 AM
    try {
      cron.schedule('30 3 * * *', () => {
        limpiarRefreshTokens();
      });
      console.log('⏰ Limpieza de refresh tokens programada (3:30 AM)');
    } catch (err) {
      console.error('Error al programar limpieza de refresh tokens:', err.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

iniciar();
