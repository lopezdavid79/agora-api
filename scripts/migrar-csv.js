/**
 * migrar-csv.js
 * ==============
 * Migra los datos de db/base_de_datos.csv a la base de datos
 * configurada en .env (agoraargentina_agoraDb).
 *
 * Uso:
 *   node scripts/migrar-csv.js
 *
 * Requisitos:
 *   - .env con DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
 *   - MySQL corriendo con la base creada (node scripts/crear-base.js)
 *   - Las tablas deben existir (correr src/app.js o el SQL manualmente)
 *   - Dependencias: dotenv, mysql2, bcrypt (ya en package.json)
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// ── Constantes ───────────────────────────────────────────────────────────────
const CSV_PATH = path.join(__dirname, '..', 'db', 'base_de_datos.csv');
const PASSWORD_TEMPORAL = 'AgoraArgentina2026!';
const SALT_ROUNDS = 10;

// ── Mapeo de columnas del CSV a campos de la DB ──────────────────────────────
const COLUMNAS = {
  //                nombre_columna_csv                    , campo_db
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

/**
 * Parsea un CSV completo (con soporte de campos multilínea entre comillas)
 * Devuelve un array de arrays (filas × columnas).
 */
function parsearCsvCompleto(texto) {
  const filas = [];
  let filaActual = [];
  let campoActual = '';
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];

    if (enComillas) {
      if (ch === '"') {
        // Fin de comillas, salvo que sea doble comilla escapada ""
        if (i + 1 < texto.length && texto[i + 1] === '"') {
          campoActual += '"';
          i++; // saltar la siguiente
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
        filaActual.push(campoActual);
        campoActual = '';
      } else if (ch === '\r') {
        // ignorar carriage return
      } else if (ch === '\n') {
        filaActual.push(campoActual);
        campoActual = '';
        // Ignorar filas completamente vacías
        if (filaActual.some(c => c.trim() !== '')) {
          filas.push(filaActual);
        }
        filaActual = [];
      } else {
        campoActual += ch;
      }
    }
  }

  // Último campo/fila
  filaActual.push(campoActual);
  if (filaActual.some(c => c.trim() !== '')) {
    filas.push(filaActual);
  }

  return filas;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function limpiar(valor) {
  if (valor === undefined || valor === null) return null;
  const str = String(valor).trim();
  return str === '' || str === '-' || str === '--' || str === '.' || str === '...' || str === 'N/A' ? null : str;
}

function parsearFecha(valor) {
  const raw = limpiar(valor);
  if (!raw) return null;

  // Formatos posibles: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const partes = raw.split(/[/-]/);
  if (partes.length !== 3) return null;

  let dia, mes, anio;

  if (partes[0].length === 4) {
    // YYYY-MM-DD
    anio = parseInt(partes[0], 10);
    mes  = parseInt(partes[1], 10);
    dia  = parseInt(partes[2], 10);
  } else {
    // DD/MM/YYYY o DD-MM-YYYY
    dia  = parseInt(partes[0], 10);
    mes  = parseInt(partes[1], 10);
    anio = parseInt(partes[2], 10);
  }

  if (isNaN(anio) || isNaN(mes) || isNaN(dia)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function limpiarDni(valor) {
  const raw = limpiar(valor);
  if (!raw) return null;
  return raw.replace(/\D/g, ''); // solo dígitos
}

function parsearBool(valor) {
  // Retorna 1/0 para TINYINT (acepta_autorizacion)
  const raw = limpiar(valor);
  if (!raw) return 0;
  const lower = raw.toLowerCase();
  if (lower === 'sí' || lower === 'si' || lower === 's' || lower === 'yes') return 1;
  return 0;
}

function separarLinksDrive(raw) {
  if (!raw) return [];
  return raw.split(',')
    .map(l => l.trim())
    .filter(l => l.startsWith('http'));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('═'.repeat(65));
  console.log('  Migración CSV → agoraargentina_agoraDb');
  console.log('═'.repeat(65));
  console.log('');

  // 1. Validar .env
  const dbName = process.env.DB_NAME;
  if (!dbName) {
    console.error('❌ DB_NAME no está definido en .env');
    console.error('   Asegurate de tener un archivo .env con las credenciales.');
    process.exit(1);
  }

  // 2. Leer CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ No se encuentra el archivo CSV: ${CSV_PATH}`);
    process.exit(1);
  }

  const csvRaw = fs.readFileSync(CSV_PATH, 'utf-8');
  const filas = parsearCsvCompleto(csvRaw);

  if (filas.length < 2) {
    console.error('❌ El CSV no tiene datos (solo header o vacío)');
    process.exit(1);
  }

  const headers = filas[0];
  const lineas = filas.slice(1); // filas de datos

  // Índice de columnas: header_pos -> nombre_corto
  const colIndex = {};
  const columnasValores = Object.entries(COLUMNAS);
  for (const [corto, largo] of columnasValores) {
    const idx = headers.findIndex(h => h.trim() === largo.trim());
    if (idx !== -1) {
      colIndex[corto] = idx;
    } else {
      console.warn(`  ⚠ Columna no encontrada en CSV: "${largo}"`);
    }
  }

  console.log(`  📋 CSV leído: ${lineas.length} filas, ${headers.length} columnas`);
  console.log('');

  // 3. Conectar a MySQL
  const connection = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT, 10) || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: dbName,
    charset:  'utf8mb4',
  });

  console.log('  ✅ Conectado a MySQL — ' + dbName);
  console.log('');

  // 4. Hash de contraseña (una vez, mismo hash para todos)
  const passwordHash = await bcrypt.hash(PASSWORD_TEMPORAL, SALT_ROUNDS);

  let insertados = 0;
  let omitidos = 0;
  const errores = [];

  // 5. Procesar cada fila
  for (let i = 0; i < lineas.length; i++) {
    const campos = lineas[i];
    const filaNum = i + 2; // fila en Excel (1-indexed; +1 por header + base 0 → +2)

    const get = (corto) => {
      const idx = colIndex[corto];
      return idx !== undefined ? (campos[idx] || '').trim() : '';
    };

    const dniRaw   = limpiarDni(get('DNI'));
    const email    = limpiar(get('EMAIL'));
    const nombre   = limpiar(get('NOMBRE'));
    const apellido = limpiar(get('APELLIDO'));

    if (!dniRaw || !email) {
      const msg = `Fila ${filaNum}: DNI o email vacío (${nombre || '?'} ${apellido || '?'}) → omitida`;
      console.warn(`  ⚠ ${msg}`);
      errores.push(msg);
      omitidos++;
      continue;
    }

    try {
      // ── 5a. USUARIO ─────────────────────────────────────────────
      const emailLower = email.toLowerCase();

      const [usuarioRows] = await connection.execute(
        `SELECT id FROM usuarios WHERE dni = ? OR email = ?`,
        [dniRaw, emailLower]
      );

      let usuarioId;
      let yaExistia = false;

      if (usuarioRows.length > 0) {
        usuarioId = usuarioRows[0].id;
        yaExistia = true;
        console.log(`  → Fila ${filaNum}: usuario ya existe (dni=${dniRaw}), actualizando perfil`);
      } else {
        const [result] = await connection.execute(
          `INSERT INTO usuarios (dni, email, password, rol, activo)
           VALUES (?, ?, ?, 'Candidato', 1)`,
          [dniRaw, emailLower, passwordHash]
        );
        usuarioId = result.insertId;
      }

      // ── 5b. PERFIL ──────────────────────────────────────────────
      const fechaNac = parsearFecha(get('FECHA_NAC'));

      if (yaExistia) {
        // UPDATE
        await connection.execute(`
          UPDATE candidatos_perfil SET
            nombre                  = ?,
            apellido                = ?,
            celular                 = ?,
            fecha_nacimiento        = ?,
            genero                  = ?,
            pais_residencia         = ?,
            nacionalidad            = ?,
            jurisdiccion            = ?,
            ciudad                  = ?,
            discapacidad_visual     = ?,
            condicion_visual        = ?,
            otra_discapacidad       = ?,
            descripcion_otra_disc   = ?,
            tiene_cud               = ?,
            beneficio_social        = ?,
            tipo_escolaridad        = ?,
            nivel_educativo         = ?,
            carrera_estudios        = ?,
            braille                 = ?,
            autonomia               = ?,
            apoyos_desplazamiento   = ?,
            vinculo_tecnologia      = ?,
            herramientas_tecnologicas = ?,
            idiomas                 = ?,
            emprendimiento          = ?,
            busqueda_formacion      = ?,
            tipo_formacion_buscada  = ?,
            busqueda_empleo         = ?,
            tiene_trabajo_actual    = ?,
            area_trabajo_actual     = ?,
            informacion_adicional   = ?,
            acepta_autorizacion     = ?
          WHERE usuario_id = ?`,
          [
            nombre, apellido,
            limpiar(get('CELULAR')),
            fechaNac,
            limpiar(get('GENERO')),
            limpiar(get('PAIS')),
            limpiar(get('NACIONALIDAD')),
            limpiar(get('JURISDICCION')),
            limpiar(get('CIUDAD')),
            limpiar(get('DISCAPACIDAD_VISUAL')),
            limpiar(get('CONDICION_VISUAL')),
            limpiar(get('OTRA_DISC')),
            limpiar(get('DESC_OTRA_DISC')),
            limpiar(get('TIENE_CUD')),
            limpiar(get('BENEFICIO')),
            limpiar(get('TIPO_ESCOLARIDAD')),
            limpiar(get('NIVEL_EDUCATIVO')),
            limpiar(get('CARRERA')),
            limpiar(get('BRAILLE')),
            limpiar(get('AUTONOMIA')),
            limpiar(get('APOYOS_DESP')),
            limpiar(get('VINCULO_TEC')),
            limpiar(get('HERRAMIENTAS_TEC')),
            limpiar(get('IDIOMAS')),
            limpiar(get('EMPRENDIMIENTO')),
            limpiar(get('BUSQ_FORMACION')),
            limpiar(get('TIPO_FORMACION')),
            limpiar(get('BUSQ_EMPLEO')),
            limpiar(get('TRABAJO_ACTUAL')),
            limpiar(get('AREA_TRABAJO')),
            limpiar(get('INFO_ADICIONAL')),
            parsearBool(get('AUTORIZACION')),
            usuarioId,
          ]
        );
      } else {
        // INSERT
        await connection.execute(`
          INSERT INTO candidatos_perfil (
            usuario_id,
            nombre, apellido, celular, fecha_nacimiento, genero,
            pais_residencia, nacionalidad, jurisdiccion, ciudad,
            discapacidad_visual, condicion_visual,
            otra_discapacidad, descripcion_otra_disc,
            tiene_cud, beneficio_social,
            tipo_escolaridad, nivel_educativo, carrera_estudios,
            braille, autonomia, apoyos_desplazamiento,
            vinculo_tecnologia, herramientas_tecnologicas,
            idiomas, emprendimiento,
            busqueda_formacion, tipo_formacion_buscada,
            busqueda_empleo, tiene_trabajo_actual, area_trabajo_actual,
            informacion_adicional, acepta_autorizacion,
            estado_perfil
          ) VALUES (
            ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?,
            'Pendiente'
          )`,
          [
            usuarioId,
            nombre, apellido,
            limpiar(get('CELULAR')),
            fechaNac,
            limpiar(get('GENERO')),
            limpiar(get('PAIS')),
            limpiar(get('NACIONALIDAD')),
            limpiar(get('JURISDICCION')),
            limpiar(get('CIUDAD')),
            limpiar(get('DISCAPACIDAD_VISUAL')),
            limpiar(get('CONDICION_VISUAL')),
            limpiar(get('OTRA_DISC')),
            limpiar(get('DESC_OTRA_DISC')),
            limpiar(get('TIENE_CUD')),
            limpiar(get('BENEFICIO')),
            limpiar(get('TIPO_ESCOLARIDAD')),
            limpiar(get('NIVEL_EDUCATIVO')),
            limpiar(get('CARRERA')),
            limpiar(get('BRAILLE')),
            limpiar(get('AUTONOMIA')),
            limpiar(get('APOYOS_DESP')),
            limpiar(get('VINCULO_TEC')),
            limpiar(get('HERRAMIENTAS_TEC')),
            limpiar(get('IDIOMAS')),
            limpiar(get('EMPRENDIMIENTO')),
            limpiar(get('BUSQ_FORMACION')),
            limpiar(get('TIPO_FORMACION')),
            limpiar(get('BUSQ_EMPLEO')),
            limpiar(get('TRABAJO_ACTUAL')),
            limpiar(get('AREA_TRABAJO')),
            limpiar(get('INFO_ADICIONAL')),
            parsearBool(get('AUTORIZACION')),
          ]
        );
      }

      // Obtener perfil_id
      const [[perfilRow]] = await connection.execute(
        `SELECT id FROM candidatos_perfil WHERE usuario_id = ?`,
        [usuarioId]
      );
      const perfilId = perfilRow.id;

      // ── 5c. DOCUMENTOS (links de Drive) ─────────────────────────
      const rawDocs = limpiar(get('DOCS_DRIVE'));
      const links = separarLinksDrive(rawDocs);

      if (links.length > 0) {
        // Borrar documentos previos si actualizamos
        if (yaExistia) {
          await connection.execute(
            `DELETE FROM documentos WHERE perfil_id = ?`,
            [perfilId]
          );
        }

        const tipoMap = { 0: 'CV', 1: 'DNI', 2: 'CUD' };
        for (let j = 0; j < links.length; j++) {
          const tipo = tipoMap[j] || 'Otro';
          await connection.execute(
            `INSERT INTO documentos (perfil_id, tipo_documento, url_drive)
             VALUES (?, ?, ?)`,
            [perfilId, tipo, links[j]]
          );
        }
      }

      insertados++;
      console.log(`  ✓ Fila ${filaNum}: ${nombre || ''} ${apellido || ''} — ${links.length} documento(s)`);

    } catch (err) {
      const msg = `Fila ${filaNum}: ERROR — ${err.message}`;
      console.error(`  ✗ ${msg}`);
      errores.push(msg);
      omitidos++;
    }
  }

  // 6. Recalcular completitud de perfiles
  console.log('');
  console.log('  ── Recalculando completitud ──');
  const actualizados = await recalcularCompletitud(connection);
  console.log(`  ✓ ${actualizados} perfiles actualizados`);

  // 7. Cerrar conexión
  await connection.end();

  // 8. Resumen
  console.log('');
  console.log('═'.repeat(65));
  console.log(`  Resultado:`);
  console.log(`    ✓ ${insertados} registros importados/actualizados`);
  console.log(`    ✓ ${actualizados} perfiles con completitud recalculada`);
  console.log(`    ⚠ ${omitidos} omitidos (errores o datos inválidos)`);
  console.log(`    📁 Total en CSV: ${lineas.length} filas`);

  if (errores.length > 0) {
    console.log('');
    console.log('  Detalle de errores/advertencias:');
    for (const e of errores) {
      console.log(`    · ${e}`);
    }
  }

  console.log('═'.repeat(65));
  console.log('');

  if (omitidos === 0) {
    console.log('  🎉 Migración completada sin errores.');
  } else {
    console.log('  ⚠ Migración completada con algunos errores (ver arriba).');
  }
  console.log('');

  process.exit(omitidos === 0 ? 0 : 1);
}

// ── Cálculo de completitud ────────────────────────────────────

const GRUPOS_COMPLETITUD = [
  { nombre: 'Datos personales', peso: 25, campos: ['nombre', 'apellido', 'celular', 'fecha_nacimiento', 'genero', 'pais_residencia', 'nacionalidad', 'jurisdiccion', 'ciudad'] },
  { nombre: 'Discapacidad', peso: 15, campos: ['discapacidad_visual', 'condicion_visual', 'tiene_cud', 'beneficio_social'] },
  { nombre: 'Educación', peso: 15, campos: ['tipo_escolaridad', 'nivel_educativo', 'carrera_estudios'] },
  { nombre: 'Autonomía y tecnología', peso: 15, campos: ['braille', 'autonomia', 'apoyos_desplazamiento', 'vinculo_tecnologia', 'herramientas_tecnologicas'] },
  { nombre: 'Idiomas y emprendimiento', peso: 10, campos: ['idiomas', 'emprendimiento'] },
  { nombre: 'Formación y empleo', peso: 15, campos: ['busqueda_formacion', 'tipo_formacion_buscada', 'busqueda_empleo', 'tiene_trabajo_actual', 'area_trabajo_actual'] },
  { nombre: 'Consentimiento', peso: 5, campos: ['acepta_autorizacion'] },
];

function calcularCompletitud(fila) {
  let puntaje = 0;
  for (const grupo of GRUPOS_COMPLETITUD) {
    const llenos = grupo.campos.filter(c => {
      const val = fila[c];
      return val !== null && val !== undefined && String(val).trim() !== '' && String(val).trim() !== '0';
    }).length;
    puntaje += (grupo.campos.length > 0 ? llenos / grupo.campos.length : 0) * grupo.peso;
  }
  return Math.round(puntaje);
}

async function recalcularCompletitud(conn) {
  const [perfiles] = await conn.execute('SELECT * FROM candidatos_perfil');
  let actualizados = 0;
  for (const perfil of perfiles) {
    const puntaje = calcularCompletitud(perfil);
    await conn.execute('UPDATE candidatos_perfil SET porcentaje_completitud = ? WHERE id = ?', [puntaje, perfil.id]);
    actualizados++;
  }
  return actualizados;
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
