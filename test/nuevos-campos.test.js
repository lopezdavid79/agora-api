const path = require('path');
const assert = require('assert');

// ── Helpers ───────────────────────────────────────────────────
function withMocks(mocks, controllerPath, fn) {
  const resolved = {};
  const originals = {};
  try {
    for (const [reqPath, mockExports] of Object.entries(mocks)) {
      const resolvedPath = require.resolve(reqPath, { paths: [path.join(__dirname, '..')] });
      resolved[reqPath] = resolvedPath;
      originals[resolvedPath] = require.cache[resolvedPath];
      require.cache[resolvedPath] = { exports: mockExports };
    }

    const fullPath = path.join(__dirname, '..', 'src', 'controllers', controllerPath);
    delete require.cache[require.resolve(fullPath)];
    const controller = require(fullPath);
    return fn(controller);
  } finally {
    for (const [, resolvedPath] of Object.entries(resolved)) {
      if (originals[resolvedPath] === undefined) {
        delete require.cache[resolvedPath];
      } else {
        require.cache[resolvedPath] = originals[resolvedPath];
      }
    }
    try {
      delete require.cache[require.resolve(path.join(__dirname, '..', 'src', 'controllers', controllerPath))];
    } catch (e) {}
  }
}

function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (s) => { res.statusCode = s; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

// ── Tests ─────────────────────────────────────────────────────
async function runTests() {
  console.log('Running nuevos-campos tests...');
  const corridas = [];

  // ── 1. aceptaAutorizacion default en perfil nuevo ─────────────
  corridas.push(new Promise(hecho => {
    (function testAceptaAutorizacionDefault() {
      const modelsPath = path.join(__dirname, '..', 'src', 'models', 'index.js');
      const mocks = {
        [modelsPath]: {
          CandidatoPerfil: {
            findOne: async () => ({
              id: 99,
              usuarioId: 10,
              nombre: null,
              apellido: null,
              aceptaAutorizacion: false,
              update: async function (data) {
                Object.assign(this, data);
                return this;
              },
            }),
          },
          Usuario: { update: async () => [1] },
        },
      };

      withMocks(mocks, 'candidatos.controller.js', (controller) => {
        const req = {
          usuario: { id: 10, rol: 'Candidato' },
          body: { nombre: 'Test' },
        };
        const res = makeRes();
        return controller.actualizarPerfil(req, res).then(() => {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(res.body.perfil.aceptaAutorizacion, false);
          console.log('✔ acepta_autorizacion default false');
          hecho();
        });
      });
    })();
  }));

  // ── 2. Actualizar aceptaAutorizacion a true ─────────────────
  corridas.push(new Promise(hecho => {
    (function testAceptaAutorizacionUpdate() {
      const modelsPath = path.join(__dirname, '..', 'src', 'models', 'index.js');
      const perfilActual = {
        id: 99,
        usuarioId: 10,
        nombre: 'Test',
        aceptaAutorizacion: false,
        update: async function (data) {
          Object.assign(this, data);
          return this;
        },
      };

      const mocks = {
        [modelsPath]: {
          CandidatoPerfil: { findOne: async () => perfilActual },
          Usuario: { update: async () => [1] },
        },
      };

      withMocks(mocks, 'candidatos.controller.js', (controller) => {
        const req = {
          usuario: { id: 10, rol: 'Candidato' },
          body: { aceptaAutorizacion: true },
        };
        const res = makeRes();
        return controller.actualizarPerfil(req, res).then(() => {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(res.body.perfil.aceptaAutorizacion, true);
          console.log('✔ acepta_autorizacion actualizado a true');
          hecho();
        });
      });
    })();
  }));

  // ── 3. Preferencias: obtener crea con defaults ──────────────
  corridas.push(new Promise(hecho => {
    (function testPreferenciasGetCreaDefaults() {
      const modelsPath = path.join(__dirname, '..', 'src', 'models', 'index.js');
      let creada = false;

      const mocks = {
        [modelsPath]: {
          PreferenciaUsuario: {
            findOne: async () => null,
            create: async (data) => {
              creada = true;
              return { id: 1, ...data, modoOscuro: false, tamanoFuente: 'normal', altoContraste: false };
            },
          },
        },
      };

      withMocks(mocks, 'preferencias.controller.js', (controller) => {
        const req = { usuario: { id: 10 } };
        const res = makeRes();
        return controller.obtenerPreferencias(req, res).then(() => {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(creada, true);
          assert.strictEqual(res.body.modoOscuro, false);
          assert.strictEqual(res.body.tamanoFuente, 'normal');
          console.log('✔ preferencias: get crea defaults');
          hecho();
        });
      });
    })();
  }));

  // ── 4. Preferencias: actualizar modo oscuro ─────────────────
  corridas.push(new Promise(hecho => {
    (function testPreferenciasUpdate() {
      const modelsPath = path.join(__dirname, '..', 'src', 'models', 'index.js');
      const upsertCalls = [];

      const mocks = {
        [modelsPath]: {
          PreferenciaUsuario: {
            upsert: async (data) => {
              upsertCalls.push(data);
              return [{ id: 1, ...data }, false];
            },
          },
        },
      };

      withMocks(mocks, 'preferencias.controller.js', (controller) => {
        const req = {
          usuario: { id: 10 },
          body: { modoOscuro: true },
        };
        const res = makeRes();
        return controller.actualizarPreferencias(req, res).then(() => {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(upsertCalls.length, 1);
          assert.strictEqual(upsertCalls[0].usuarioId, 10);
          assert.strictEqual(upsertCalls[0].modoOscuro, true);
          console.log('✔ preferencias: update modoOscuro');
          hecho();
        });
      });
    })();
  }));

  // ── 5. Preferencias: rechazar campos inválidos ──────────────
  corridas.push(new Promise(hecho => {
    (function testPreferenciasRechazaInvalido() {
      const modelsPath = path.join(__dirname, '..', 'src', 'models', 'index.js');

      const mocks = {
        [modelsPath]: {
          PreferenciaUsuario: {
            upsert: async () => { throw new Error('No debería llamarse'); },
          },
        },
      };

      withMocks(mocks, 'preferencias.controller.js', (controller) => {
        const req = {
          usuario: { id: 10 },
          body: { colorFavorito: 'azul' },
        };
        const res = makeRes();
        return controller.actualizarPreferencias(req, res).then(() => {
          assert.strictEqual(res.statusCode, 400);
          assert.ok(res.body.error.includes('válidos'));
          console.log('✔ preferencias: rechaza campo inválido');
          hecho();
        });
      });
    })();
  }));

  await Promise.all(corridas);
  console.log('Nuevos-campos tests completed');
}

module.exports = { runTests };
