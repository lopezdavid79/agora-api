/**
 * Seed: crea un usuario Administrador para pruebas desde el frontend.
 *
 * Uso: node scripts/seed-admin.js
 *
 * Puede ejecutarse múltiples veces — ignora si el email ya existe.
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize } = require('../src/config/database');
const { Usuario, CandidatoPerfil } = require('../src/models/index');

const ADMIN = {
  dni:      '99999999',
  email:    'admin@agora.com',
  password: 'Admin2026!',
  rol:      'Administrador',
};

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    // Migrar columnas faltantes si el seed corre sin el servidor
    const migraciones = [
      'ALTER TABLE candidatos_perfil ADD COLUMN observacion_perfil TEXT NULL AFTER informacion_adicional',
      'ALTER TABLE candidatos_perfil ADD COLUMN fecha_observacion DATETIME NULL AFTER observacion_perfil',
      'ALTER TABLE candidatos_perfil ADD COLUMN acepta_autorizacion TINYINT(1) NULL DEFAULT 0 AFTER fecha_observacion',
    ];
    for (const sql of migraciones) {
      try { await sequelize.query(sql); } catch (e) {
        const code = e?.original?.errno ?? e?.errno;
        if (code !== 1060) throw e;
      }
    }

    // Verificar si ya existe
    const existe = await Usuario.findOne({ where: { email: ADMIN.email } });
    if (existe) {
      console.log('ℹ️  El usuario admin ya existe (email: ' + ADMIN.email + ')');
      console.log('   Para重置ear, eliminá el registro manualmente.');
      await sequelize.close();
      return;
    }

    const hash = await bcrypt.hash(ADMIN.password, 10);

    const usuario = await Usuario.create({
      dni:      ADMIN.dni,
      email:    ADMIN.email,
      password: hash,
      rol:      ADMIN.rol,
      activo:   true,
    });

    // Opcional: crear perfil vacío (por si el frontend lo requiere)
    await CandidatoPerfil.create({
      usuarioId:             usuario.id,
      estadoPerfil:          'Aprobado',
      porcentajeCompletitud: 0,
    });

    console.log('✅ Usuario administrador creado:');
    console.log('   Email:    ' + ADMIN.email);
    console.log('   DNI:      ' + ADMIN.dni);
    console.log('   Password: ' + ADMIN.password);
    console.log('   Rol:      ' + ADMIN.rol);

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al crear admin:', err);
    process.exit(1);
  }
}

seed();
