/**
 * crear-base.js
 * =============
 * Crea la base de datos leyendo las credenciales del .env
 *
 * Uso:
 *   node scripts/crear-base.js
 *
 * Requisitos:
 *   - .env con DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
 *   - MySQL corriendo
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function crearBase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASS || '';
  const dbName = process.env.DB_NAME;

  if (!dbName) {
    console.error('❌ DB_NAME no está definido en .env');
    process.exit(1);
  }

  try {
    // Conectar sin especificar base de datos
    const connection = await mysql.createConnection({ host, port, user, password });

    // Crear la base si no existe
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    console.log(`✅ Base de datos "${dbName}" creada (o ya existía)`);
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al crear la base de datos:');
    console.error(`   ${err.message}`);
    console.error('');
    console.error('   Verificá que:');
    console.error('   - MySQL esté corriendo (XAMPP, WAMP, etc.)');
    console.error(`   - Las credenciales en .env sean correctas`);
    console.error(`   - El usuario tenga permisos para crear bases`);
    process.exit(1);
  }
}

crearBase();
