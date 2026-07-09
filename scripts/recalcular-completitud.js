/**
 * recalcular-completitud.js
 * =========================
 * Recalcula el porcentaje de completitud de todos los candidatos
 * que están en 0% o se migraron sin calcular el porcentaje.
 *
 * Uso:
 *   node scripts/recalcular-completitud.js
 *
 * Requisitos:
 *   - .env con credenciales de DB
 *   - Migraciones ejecutadas
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sequelize } = require('../src/config/database');
const {
  CandidatoPerfil,
  CandidatoDiscapacidad,
  CandidatoFormacion,
  CandidatoLaboral,
} = require('../src/models/index');
const { calcularCompletitud } = require('../src/controllers/candidatos.controller');

async function recalcular() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a MySQL');
    console.log('');

    const perfiles = await CandidatoPerfil.findAll({
      include: [
        { model: CandidatoDiscapacidad, as: 'discapacidad' },
        { model: CandidatoFormacion, as: 'formacion' },
        { model: CandidatoLaboral, as: 'laboral' },
      ],
    });

    console.log(`📄 ${perfiles.length} perfiles encontrados`);
    console.log('');

    let actualizados = 0;
    let saltados = 0;

    for (const perfil of perfiles) {
      const disc = perfil.discapacidad || {};
      const form = perfil.formacion || {};
      const lab  = perfil.laboral || {};

      const datos = {
        // Datos personales
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        celular: perfil.celular,
        fechaNacimiento: perfil.fechaNacimiento,
        genero: perfil.genero,
        paisResidencia: perfil.paisResidencia,
        nacionalidad: perfil.nacionalidad,
        jurisdiccion: perfil.jurisdiccion,
        ciudad: perfil.ciudad,
        informacionAdicional: perfil.informacionAdicional,
        aceptaAutorizacion: perfil.aceptaAutorizacion,
        // Discapacidad
        discapacidadVisual: disc.discapacidadVisual,
        condicionVisual: disc.condicionVisual,
        tieneCud: disc.tieneCud,
        otraDiscapacidad: disc.otraDiscapacidad,
        descripcionOtraDisc: disc.descripcionOtraDisc,
        beneficioSocial: disc.beneficioSocial,
        // Formación
        tipoEscolaridad: form.tipoEscolaridad,
        nivelEducativo: form.nivelEducativo,
        carreraEstudios: form.carreraEstudios,
        braille: form.braille,
        autonomia: form.autonomia,
        apoyosDesplazamiento: form.apoyosDesplazamiento,
        vinculoTecnologia: form.vinculoTecnologia,
        herramientasTecnologicas: form.herramientasTecnologicas,
        idiomas: form.idiomas,
        busquedaFormacion: form.busquedaFormacion,
        tipoFormacionBuscada: form.tipoFormacionBuscada,
        // Laboral
        busquedaEmpleo: lab.busquedaEmpleo,
        tieneTrabajoActual: lab.tieneTrabajoActual,
        areaTrabajoActual: lab.areaTrabajoActual,
        emprendimiento: lab.emprendimiento,
      };

      const completitud = calcularCompletitud(datos);

      if (completitud !== perfil.porcentajeCompletitud) {
        await perfil.update({ porcentajeCompletitud: completitud });
        actualizados++;
        console.log(`  ✓ ${perfil.nombre || '?'} ${perfil.apellido || ''} → ${completitud}%`);
      } else {
        saltados++;
      }
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log(`  ✅ ${actualizados} actualizados | ⏭ ${saltados} ya estaban correctos`);
    console.log('═'.repeat(60));

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

recalcular();
