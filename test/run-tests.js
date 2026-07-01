// Minimal test runner to avoid new dev-dependencies
const path = require('path');
const assert = require('assert');

async function run() {
  console.log('Running tests...');

  const candidatos = require(path.join(__dirname, '..', 'src', 'controllers', 'candidatos.controller'));

  // Test calcularCompletitud
  (function testCalcularCompletitud() {
    const perfilVacio = {};
    const porcentajeVacio = candidatos.calcularCompletitud(perfilVacio);
    assert.strictEqual(typeof porcentajeVacio, 'number');
    if (porcentajeVacio !== 0) throw new Error('Expected 0 for empty profile');

    const perfilCompleto = {};
    const campos = [
      'nombre','apellido','celular','fechaNacimiento','genero',
      'jurisdiccion','ciudad','paisResidencia','nacionalidad',
      'discapacidadVisual','condicionVisual','tieneCud',
      'otraDiscapacidad','descripcionOtraDisc','beneficioSocial',
      'tipoEscolaridad','nivelEducativo','carreraEstudios',
      'braille','autonomia','apoyosDesplazamiento','vinculoTecnologia',
      'herramientasTecnologicas','idiomas',
      'busquedaEmpleo','tieneTrabajoActual','areaTrabajoActual',
      'busquedaFormacion','tipoFormacionBuscada','emprendimiento',
      'informacionAdicional','aceptaAutorizacion',
    ];
    campos.forEach(c => perfilCompleto[c] = 'x');
    const porcentajeCompleto = candidatos.calcularCompletitud(perfilCompleto);
    if (porcentajeCompleto !== 100) throw new Error('Expected 100 for full profile');

    const perfilMitad = {};
    campos.slice(0, Math.floor(campos.length/2)).forEach(c => perfilMitad[c] = 'x');
    const porcentajeMitad = candidatos.calcularCompletitud(perfilMitad);
    if (porcentajeMitad <= 0 || porcentajeMitad >= 100) throw new Error('Expected partial percentage for half-filled profile');

    console.log('✔ calcularCompletitud tests passed');
  })();

  // Run auth tests (isolated file)
  try {
    const authTests = require(path.join(__dirname, 'auth.test'));
    if (authTests && typeof authTests.runTests === 'function') {
      await authTests.runTests();
    }
  } catch (err) {
    console.error('Auth tests failed to run:', err);
    throw err;
  }

  // Run flujo-completo tests
  try {
    const flujoTests = require(path.join(__dirname, 'flujo-completo.test'));
    if (flujoTests && typeof flujoTests.runTests === 'function') {
      await flujoTests.runTests();
    }
  } catch (err) {
    console.error('Flujo-completo tests failed to run:', err);
    throw err;
  }

  // Run nuevos-campos tests
  try {
    const nuevosTests = require(path.join(__dirname, 'nuevos-campos.test'));
    if (nuevosTests && typeof nuevosTests.runTests === 'function') {
      await nuevosTests.runTests();
    }
  } catch (err) {
    console.error('Nuevos-campos tests failed to run:', err);
    throw err;
  }

  console.log('All tests passed');
}

run().then(() => process.exit(0)).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
