/**
 * setup.js
 * ========
 * Script unificado de configuración inicial.
 * Crea la base de datos, sincroniza modelos, corre migraciones,
 * seedea el admin, migra el CSV y recalcula completitud de perfiles.
 *
 * Uso:
 *   node scripts/setup.js            # todo desde cero
 *   node scripts/setup.js --csv      # solo migrar CSV + completitud
 *   node scripts/setup.js --completitud  # solo recalcular completitud
 *
 * Requisitos:
 *   - .env con DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
 *   - MySQL corriendo
 *   - Dependencias: dotenv, mysql2, bcrypt, umzug (ya en package.json)
 */

require('dotenv').config();
const path = require('path');
const fs   = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { sequelize } = require('../src/config/database');
const umzug = require('../src/config/umzug');
const { Op } = require('sequelize');

const args = process.argv.slice(2);
const CSV_PATH = path.join(__dirname, '..', 'db', 'base_de_datos.csv');

// ────────────────────────────────────────────────────────────────
//  CAMPOS PARA CÁLCULO DE COMPLETITUD
// ────────────────────────────────────────────────────────────────
// Se agrupan por categoría; cada grupo tiene un peso fijo.
// Dentro de cada grupo se promedia cuántos campos están llenos.
const GRUPOS_COMPLETITUD = [
  {
    nombre: 'Datos personales',
    peso: 25,
    campos: [
      'nombre', 'apellido', 'celular', 'fecha_nacimiento',
      'genero', 'pais_residencia', 'nacionalidad', 'jurisdiccion', 'ciudad',
    ],
  },
  {
    nombre: 'Discapacidad',
    peso: 15,
    campos: [
      'discapacidad_visual', 'condicion_visual', 'tiene_cud', 'beneficio_social',
    ],
  },
  {
    nombre: 'Educación',
    peso: 15,
    campos: [
      'tipo_escolaridad', 'nivel_educativo', 'carrera_estudios',
    ],
  },
  {
    nombre: 'Autonomía y tecnología',
    peso: 15,
    campos: [
      'braille', 'autonomia', 'apoyos_desplazamiento',
      'vinculo_tecnologia', 'herramientas_tecnologicas',
    ],
  },
  {
    nombre: 'Idiomas y emprendimiento',
    peso: 10,
    campos: [
      'idiomas', 'emprendimiento',
    ],
  },
  {
    nombre: 'Formación y empleo',
    peso: 15,
    campos: [
      'busqueda_formacion', 'tipo_formacion_buscada',
      'busqueda_empleo', 'tiene_trabajo_actual', 'area_trabajo_actual',
    ],
  },
  {
    nombre: 'Consentimiento',
    peso: 5,
    campos: [
      'acepta_autorizacion',
    ],
  },
];

const TOTAL_PESO = GRUPOS_COMPLETITUD.reduce((s, g) => s + g.peso, 0);
if (TOTAL_PESO !== 100) {
  console.warn(`  ⚠ Los pesos de completitud suman ${TOTAL_PESO}, deberían ser 100`);
}

// ────────────────────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────────────────────

function clean(valor) {
  if (valor === undefined || valor === null) return null;
  const str = String(valor).trim();
  return str === '' || str === '-' || str === '--' || str === '.' || str === '...' || str === 'N/A' ? null : str;
}

function parseDate(valor) {
  const raw = clean(valor);
  if (!raw) return null;
  const partes = raw.split(/[/-]/);
  if (partes.length !== 3) return null;
  let dia, mes, anio;
  if (partes[0].length === 4) {
    anio = parseInt(partes[0], 10); mes = parseInt(partes[1], 10); dia = parseInt(partes[2], 10);
  } else {
    dia = parseInt(partes[0], 10); mes = parseInt(partes[1], 10); anio = parseInt(partes[2], 10);
  }
  if (isNaN(anio) || isNaN(mes) || isNaN(dia)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function cleanDni(valor) {
  const raw = clean(valor);
  if (!raw) return null;
  return raw.replace(/\D/g, '');
}

function parseBool(valor) {
  const raw = clean(valor);
  if (!raw) return 0;
  const lower = raw.toLowerCase();
  return (lower === 'sí' || lower === 'si' || lower === 's' || lower === 'yes') ? 1 : 0;
}

function splitDriveLinks(raw) {
  if (!raw) return [];
  return raw.split(',').map(l => l.trim()).filter(l => l.startsWith('http'));
}

function parseCsv(texto) {
  const filas = [];
  let filaActual = [];
  let campoActual = '';
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (enComillas) {
      if (ch === '"') {
        if (i + 1 < texto.length && texto[i + 1] === '"') {
          campoActual += '"'; i++;
        } else {
          enComillas = false;
        }
      } else {
        campoActual += ch;
      }
    } else {
      if (ch === '"') {
        enComillas = true;
      } else if (ch === ',') {
        filaActual.push(campoActual); campoActual = '';
      } else if (ch === '\r') {
        // ignorar
      } else if (ch === '\n') {
        filaActual.push(campoActual); campoActual = '';
        if (filaActual.some(c => c.trim() !== '')) filas.push(filaActual);
        filaActual = [];
      } else {
        campoActual += ch;
      }
    }
  }
  filaActual.push(campoActual);
  if (filaActual.some(c => c.trim() !== '')) filas.push(filaActual);
  return filas;
}

// ────────────────────────────────────────────────────────────────
//  RECÁLCULO DE COMPLETITUD
// ────────────────────────────────────────────────────────────────

function calcularCompletitud(fila) {
  let puntaje = 0;

  for (const grupo of GRUPOS_COMPLETITUD) {
    const llenos = grupo.campos.filter(c => {
      const val = fila[c];
      return val !== null && val !== undefined && String(val).trim() !== '';
    }).length;
    const proporcion = grupo.campos.length > 0 ? llenos / grupo.campos.length : 0;
    puntaje += proporcion * grupo.peso;
  }

  return Math.round(puntaje);
}

async function recalcularCompletitud(conn) {
  console.log('');
  console.log('  ── Recalculando completitud de perfiles ──');

  const [perfiles] = await conn.execute(
    'SELECT id FROM candidatos_perfil'
  );

  if (perfiles.length === 0) {
    console.log('  ℹ️  No hay perfiles para calcular');
    return;
  }

  let actualizados = 0;
  let errores = 0;

  for (const perfil of perfiles) {
    try {
      const [rows] = await conn.execute(
        'SELECT * FROM candidatos_perfil WHERE id = ?',
        [perfil.id]
      );
      if (rows.length === 0) continue;

      const puntaje = calcularCompletitud(rows[0]);

      await conn.execute(
        'UPDATE candidatos_perfil SET porcentaje_completitud = ? WHERE id = ?',
        [puntaje, perfil.id]
      );
      actualizados++;
    } catch (err) {
      console.error(`  ✗ Error perfil #${perfil.id}: ${err.message}`);
      errores++;
    }
  }

  console.log(`  ✓ ${actualizados} perfiles actualizados`);
  if (errores > 0) console.log(`  ⚠ ${errores} errores`);
  console.log(`  ─────────────────────────────────`);
}

// ────────────────────────────────────────────────────────────────
//  PASO 1: CREAR BASE DE DATOS
// ────────────────────────────────────────────────────────────────

async function pasoCrearBase() {
  console.log('');
  console.log('  ── [1/6] Crear base de datos ──');

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASS || '';
  const dbName = process.env.DB_NAME;

  if (!dbName) {
    console.error('  ❌ DB_NAME no está definido en .env');
    process.exit(1);
  }

  const conn = await mysql.createConnection({ host, port, user, password });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
  console.log(`  ✓ "${dbName}" creada (o ya existía)`);
}

// ────────────────────────────────────────────────────────────────
//  PASO 2: SINCRONIZAR MODELOS + MIGRACIONES
// ────────────────────────────────────────────────────────────────

async function pasoSyncMigraciones() {
  console.log('');
  console.log('  ── [2/6] Sincronizar modelos y migraciones ──');

  await sequelize.sync({ force: false });
  console.log('  ✓ Modelos sincronizados');

  const pendientes = await umzug.pending();
  if (pendientes.length > 0) {
    console.log(`  📦 ${pendientes.length} migración(es) pendiente(s)`);
    await umzug.up();
    console.log('  ✓ Migraciones ejecutadas');
  } else {
    console.log('  ✓ Sin migraciones pendientes');
  }
}

// ────────────────────────────────────────────────────────────────
//  PASO 3: SEED ADMIN
// ────────────────────────────────────────────────────────────────

async function pasoSeedAdmin() {
  console.log('');
  console.log('  ── [3/6] Seed admin ──');

  const { Usuario, CandidatoPerfil } = require('../src/models/index');

  const ADMIN = {
    dni:      '99999999',
    email:    'info@agoraargentina.ar',
    password: 'Admin2026!',
    rol:      'Administrador',
  };

  const existe = await Usuario.findOne({ where: { email: ADMIN.email } });
  if (existe) {
    console.log(`  ℹ️  Admin ya existe (${ADMIN.email})`);
    return;
  }

  const hash = await bcrypt.hash(ADMIN.password, 10);
  const usuario = await Usuario.create({
    dni: ADMIN.dni, email: ADMIN.email, password: hash,
    rol: ADMIN.rol, activo: true,
  });
  await CandidatoPerfil.create({
    usuarioId: usuario.id, estadoPerfil: 'Aprobado', porcentajeCompletitud: 0,
  });

  console.log(`  ✓ Admin creado: ${ADMIN.email} / ${ADMIN.password}`);
}

// ────────────────────────────────────────────────────────────────
//  PASO 4: COLUMNAS FALTANTES (seed-admin legacy)
// ────────────────────────────────────────────────────────────────

async function pasoColumnasFaltantes() {
  console.log('');
  console.log('  ── [4/6] Verificar columnas faltantes ──');

  const migraciones = [
    'ALTER TABLE candidatos_perfil ADD COLUMN observacion_perfil TEXT NULL AFTER informacion_adicional',
    'ALTER TABLE candidatos_perfil ADD COLUMN fecha_observacion DATETIME NULL AFTER observacion_perfil',
    'ALTER TABLE candidatos_perfil ADD COLUMN acepta_autorizacion TINYINT(1) NULL DEFAULT 0 AFTER fecha_observacion',
    'ALTER TABLE candidatos_perfil ADD COLUMN porcentaje_completitud TINYINT UNSIGNED DEFAULT 0',
  ];

  let count = 0;
  for (const sql of migraciones) {
    try {
      await sequelize.query(sql);
      count++;
    } catch (e) {
      const errno = e?.original?.errno ?? e?.errno;
      if (errno !== 1060 && errno !== 1061) throw e; // 1060 = duplicate column
    }
  }
  console.log(`  ✓ ${count} columna(s) agregada(s) (si faltaban)`);
}

// ────────────────────────────────────────────────────────────────
//  PASO 5: MIGRAR CSV
// ────────────────────────────────────────────────────────────────

async function pasoMigrarCsv(conn) {
  console.log('');
  console.log('  ── [5/6] Migrar CSV ──');

  if (!fs.existsSync(CSV_PATH)) {
    console.log('  ℹ️  No se encontró db/base_de_datos.csv — salteando');
    return;
  }

  // Mapeo de columnas del CSV → campos DB
  const COLUMNAS = {
    EMAIL:             'Dirección de correo electrónico',
    NOMBRE:            'Nombre',
    APELLIDO:          'Apellido',
    DNI:               'Número de DNI',
    CELULAR:           'Celular',
    FECHA_NAC:         'Fecha de nacimiento',
    GENERO:            'Género',
    PAIS:              'País de Residencia (Te recordamos que tienen prioridad usuarios de Argentina)',
    NACIONALIDAD:      'Nacionalidad',
    JURISDICCION:      'Jurisdicción',
    CIUDAD:            'Ciudad de residencia',
    DISCAPACIDAD_VISUAL: '¿Sos una persona con discapacidad visual?',
    CONDICION_VISUAL:  'Tu condición es...',
    OTRA_DISC:         '¿Tenes, además, alguna otra discapacidad o condición que sea necesario informar?',
    DESC_OTRA_DISC:    '¿Cuál? En caso de que la respuesta anterior sea afirmativa.',
    TIENE_CUD:         '¿Tenes CUD?',
    BENEFICIO:         '¿Percibís algún tipo de beneficio?',
    TIPO_ESCOLARIDAD:  '¿A qué tipo de escolaridad asististe?',
    NIVEL_EDUCATIVO:   'Nivel Educativo',
    CARRERA:           '¿Qué carrera estudias o estudiaste?',
    BRAILLE:           '¿Sos usuario del sistema Braille?',
    AUTONOMIA:         'En relación a tu autonomía...',
    APOYOS_DESP:       'En relación a los apoyos para el desplazamiento...',
    VINCULO_TEC:       'En relación al vínculo con la tecnología...',
    HERRAMIENTAS_TEC:  '¿Qué herramientas utilizas?',
    IDIOMAS:           'Idiomas (Indicar idioma y nivel > básico, medio, avanzado)',
    EMPRENDIMIENTO:    '¿Tenes algún emprendimiento? Contanos de qué trata y dejanos las redes',
    BUSQ_FORMACION:    '¿Estás buscando formarte?',
    TIPO_FORMACION:    '¿Qué tipo de formación estas buscando?',
    BUSQ_EMPLEO:       '¿Estás buscando empleo?',
    TRABAJO_ACTUAL:    '¿Tenés trabajo actualmente?',
    AREA_TRABAJO:      '¿En qué área?',
    INFO_ADICIONAL:    '¿Hay algo más sobre vos que quieras contarnos?',
    DOCS_DRIVE:        'Por favor, subí en este espacio tu CV, DNI y CUD para poder ingresarte a la base de datos',
    AUTORIZACION:      '\u201CAutorizo al Programa ÁGORA Argentina y a las instituciones que lo acompañan institucionalmente a registrar y utilizar imágenes y/o material audiovisual generado durante las actividades para fines de difusión, comunicación institucional, informes y rendición de resultados, en medios digitales e impresos.',
  };

  const csvRaw = fs.readFileSync(CSV_PATH, 'utf-8');
  const filas = parseCsv(csvRaw);

  if (filas.length < 2) {
    console.log('  ℹ️  CSV vacío — salteando');
    return;
  }

  const headers = filas[0];
  const lineas = filas.slice(1);

  const colIndex = {};
  for (const [corto, largo] of Object.entries(COLUMNAS)) {
    const idx = headers.findIndex(h => h.trim() === largo.trim());
    if (idx !== -1) colIndex[corto] = idx;
  }

  console.log(`  📋 ${lineas.length} filas, ${headers.length} columnas`);

  const passwordHash = await bcrypt.hash('AgoraArgentina2026!', 10);
  let insertados = 0, omitidos = 0;
  const errores = [];

  for (let i = 0; i < lineas.length; i++) {
    const campos = lineas[i];
    const filaNum = i + 2;
    const get = (corto) => {
      const idx = colIndex[corto];
      return idx !== undefined ? (campos[idx] || '').trim() : '';
    };

    const dniRaw   = cleanDni(get('DNI'));
    const email    = clean(get('EMAIL'));
    const nombre   = clean(get('NOMBRE'));
    const apellido = clean(get('APELLIDO'));

    if (!dniRaw || !email) {
      errores.push(`Fila ${filaNum}: DNI o email vacío (${nombre || '?'}) → omitida`);
      omitidos++;
      continue;
    }

    try {
      const emailLower = email.toLowerCase();
      const [rows] = await conn.execute(
        'SELECT id FROM usuarios WHERE dni = ? OR email = ?',
        [dniRaw, emailLower]
      );

      let usuarioId, yaExistia = false;
      if (rows.length > 0) {
        usuarioId = rows[0].id;
        yaExistia = true;
      } else {
        const [r] = await conn.execute(
          'INSERT INTO usuarios (dni, email, password, rol, activo) VALUES (?, ?, ?, ?, 1)',
          [dniRaw, emailLower, passwordHash, 'Candidato']
        );
        usuarioId = r.insertId;
      }

      // Perfil
      const fechaNac = parseDate(get('FECHA_NAC'));
      const perfilValues = [
        nombre, apellido, clean(get('CELULAR')), fechaNac,
        clean(get('GENERO')), clean(get('PAIS')), clean(get('NACIONALIDAD')),
        clean(get('JURISDICCION')), clean(get('CIUDAD')),
        clean(get('DISCAPACIDAD_VISUAL')), clean(get('CONDICION_VISUAL')),
        clean(get('OTRA_DISC')), clean(get('DESC_OTRA_DISC')),
        clean(get('TIENE_CUD')), clean(get('BENEFICIO')),
        clean(get('TIPO_ESCOLARIDAD')), clean(get('NIVEL_EDUCATIVO')), clean(get('CARRERA')),
        clean(get('BRAILLE')), clean(get('AUTONOMIA')), clean(get('APOYOS_DESP')),
        clean(get('VINCULO_TEC')), clean(get('HERRAMIENTAS_TEC')),
        clean(get('IDIOMAS')), clean(get('EMPRENDIMIENTO')),
        clean(get('BUSQ_FORMACION')), clean(get('TIPO_FORMACION')),
        clean(get('BUSQ_EMPLEO')), clean(get('TRABAJO_ACTUAL')), clean(get('AREA_TRABAJO')),
        clean(get('INFO_ADICIONAL')), parseBool(get('AUTORIZACION')),
      ];

      if (yaExistia) {
        await conn.execute(`
          UPDATE candidatos_perfil SET
            nombre=?, apellido=?, celular=?, fecha_nacimiento=?, genero=?,
            pais_residencia=?, nacionalidad=?, jurisdiccion=?, ciudad=?,
            discapacidad_visual=?, condicion_visual=?, otra_discapacidad=?, descripcion_otra_disc=?,
            tiene_cud=?, beneficio_social=?,
            tipo_escolaridad=?, nivel_educativo=?, carrera_estudios=?,
            braille=?, autonomia=?, apoyos_desplazamiento=?,
            vinculo_tecnologia=?, herramientas_tecnologicas=?,
            idiomas=?, emprendimiento=?,
            busqueda_formacion=?, tipo_formacion_buscada=?,
            busqueda_empleo=?, tiene_trabajo_actual=?, area_trabajo_actual=?,
            informacion_adicional=?, acepta_autorizacion=?
          WHERE usuario_id = ?`,
          [...perfilValues, usuarioId]
        );
      } else {
        await conn.execute(`
          INSERT INTO candidatos_perfil (
            usuario_id, nombre, apellido, celular, fecha_nacimiento, genero,
            pais_residencia, nacionalidad, jurisdiccion, ciudad,
            discapacidad_visual, condicion_visual, otra_discapacidad, descripcion_otra_disc,
            tiene_cud, beneficio_social,
            tipo_escolaridad, nivel_educativo, carrera_estudios,
            braille, autonomia, apoyos_desplazamiento,
            vinculo_tecnologia, herramientas_tecnologicas,
            idiomas, emprendimiento,
            busqueda_formacion, tipo_formacion_buscada,
            busqueda_empleo, tiene_trabajo_actual, area_trabajo_actual,
            informacion_adicional, acepta_autorizacion,
            estado_perfil
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')`,
          [usuarioId, ...perfilValues]
        );
      }

      // Documentos
      const [[perfilRow]] = await conn.execute(
        'SELECT id FROM candidatos_perfil WHERE usuario_id = ?', [usuarioId]
      );
      const perfilId = perfilRow.id;
      const rawDocs = clean(get('DOCS_DRIVE'));
      const links = splitDriveLinks(rawDocs);

      if (links.length > 0) {
        if (yaExistia) await conn.execute('DELETE FROM documentos WHERE perfil_id = ?', [perfilId]);
        const tipoMap = { 0: 'CV', 1: 'DNI', 2: 'CUD' };
        for (let j = 0; j < links.length; j++) {
          await conn.execute(
            'INSERT INTO documentos (perfil_id, tipo_documento, url_drive) VALUES (?, ?, ?)',
            [perfilId, tipoMap[j] || 'Otro', links[j]]
          );
        }
      }

      insertados++;
      process.stdout.write(`  ✓ Fila ${filaNum}: ${nombre || ''} ${apellido || ''} — ${links.length} doc(s)\n`);
    } catch (err) {
      errores.push(`Fila ${filaNum}: ERROR — ${err.message}`);
      omitidos++;
    }
  }

  console.log(`  ─────────────────────────────────`);
  console.log(`  ✓ ${insertados} importados | ⚠ ${omitidos} omitidos`);
  if (errores.length > 0) {
    console.log('  Detalle de errores:');
    errores.forEach(e => console.log(`    · ${e}`));
  }
}

// ────────────────────────────────────────────────────────────────
//  MAIN
// ────────────────────────────────────────────────────────────────

async function main() {
  const solo = args.includes('--completitud') ? 'completitud'
    : args.includes('--csv') ? 'csv' : 'todo';

  console.log('');
  console.log('═'.repeat(65));
  console.log('  SETUP — Ágora Argentina');
  console.log(solo === 'todo' ? '  (completo)' : `  (solo ${solo})`);
  console.log('═'.repeat(65));

  try {
    if (solo === 'completitud') {
      // Solo recalcular completitud
      await sequelize.authenticate();
      console.log('  ✅ Conectado a ' + process.env.DB_NAME);
      await recalcularCompletitud(sequelize.getQueryInterface().sequelize);
      await sequelize.close();
      console.log('\n  ✅ Completitud recalculada\n');
      process.exit(0);
    }

    if (solo === 'csv') {
      // Solo migrar CSV + completitud
      await sequelize.authenticate();
      console.log('  ✅ Conectado a ' + process.env.DB_NAME);
      const conn = sequelize.getQueryInterface().sequelize;
      await pasoMigrarCsv(conn);
      await recalcularCompletitud(conn);
      await sequelize.close();
      console.log('\n  ✅ Migración CSV completada\n');
      process.exit(0);
    }

    // ── Completo ──────────────────────────────────
    // 1. Crear DB
    await pasoCrearBase();

    // 2. Sync + migraciones
    await pasoSyncMigraciones();

    // 3. Columnas faltantes (compatibilidad)
    await pasoColumnasFaltantes();

    // 4. Seed admin
    await pasoSeedAdmin();

    // 5. Migrar CSV
    const conn = sequelize.getQueryInterface().sequelize;
    await pasoMigrarCsv(conn);

    // 6. Recalcular completitud
    await recalcularCompletitud(conn);

    await sequelize.close();

    console.log('');
    console.log('═'.repeat(65));
    console.log('  ✅ Setup completado');
    console.log('═'.repeat(65));
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
