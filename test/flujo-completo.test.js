const path = require('path');
const assert = require('assert');

// ── Helpers (misma técnica que auth.test.js) ───────────────────
function withMocks(mocks, fn) {
  const resolved = {};
  const originals = {};
  try {
    for (const [reqPath, mockExports] of Object.entries(mocks)) {
      const resolvedPath = require.resolve(reqPath, { paths: [path.join(__dirname, '..')] });
      resolved[reqPath] = resolvedPath;
      originals[resolvedPath] = require.cache[resolvedPath];
      require.cache[resolvedPath] = { exports: mockExports };
    }

    const controllerPath = path.join(__dirname, '..', 'src', 'controllers', 'auth.controller.js');
    delete require.cache[require.resolve(controllerPath)];
    const controller = require(controllerPath);
    return fn(controller);
  } finally {
    for (const [, resolvedPath] of Object.entries(resolved)) {
      if (originals[resolvedPath] === undefined) {
        delete require.cache[resolvedPath];
      } else {
        require.cache[resolvedPath] = originals[resolvedPath];
      }
    }
    try { delete require.cache[require.resolve(path.join(__dirname, '..', 'src', 'controllers', 'auth.controller.js'))]; } catch (e) {}
  }
}

function withCandidatosMocks(mocks, fn) {
  const resolved = {};
  const originals = {};
  try {
    for (const [reqPath, mockExports] of Object.entries(mocks)) {
      const resolvedPath = require.resolve(reqPath, { paths: [path.join(__dirname, '..')] });
      resolved[reqPath] = resolvedPath;
      originals[resolvedPath] = require.cache[resolvedPath];
      require.cache[resolvedPath] = { exports: mockExports };
    }

    const controllerPath = path.join(__dirname, '..', 'src', 'controllers', 'candidatos.controller.js');
    delete require.cache[require.resolve(controllerPath)];
    const controller = require(controllerPath);
    return fn(controller);
  } finally {
    for (const [, resolvedPath] of Object.entries(resolved)) {
      if (originals[resolvedPath] === undefined) {
        delete require.cache[resolvedPath];
      } else {
        require.cache[resolvedPath] = originals[resolvedPath];
      }
    }
    try { delete require.cache[require.resolve(path.join(__dirname, '..', 'src', 'controllers', 'candidatos.controller.js'))]; } catch (e) {}
  }
}

function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.cookies = {};
  res.status = (s) => { res.statusCode = s; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  res.cookie = (name, val, opts) => { res.cookies[name] = { value: val, options: opts }; return res; };
  res.clearCookie = (name, opts) => { delete res.cookies[name]; return res; };
  return res;
}

// ── Base mocks common to auth controller tests ─────────────────
function modelsBaseMock(overrides = {}) {
  return {
    Usuario: {},
    CandidatoPerfil: {},
    Rol: {},
    UsuarioRol: {},
    TokenReseteo: {},
    RefreshToken: {},
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────
async function runTests() {
  console.log('Running flujo-completo tests...');
  const corridas = [];

  // ── 1. Registro exitoso ─────────────────────────────────────
  corridas.push(new Promise(hecho => {
    (function testRegistroExitoso() {
      const nuevoUsuario = {
        id: 10,
        dni: '12345678',
        email: 'nuevo@mail.com',
        password: '$2b$10$hasheado',
        rol: 'Candidato',
        activo: true,
      };

      const mocks = {
        [path.join(__dirname, '..', 'src', 'models', 'index.js')]: modelsBaseMock({
          Usuario: {
            findOne: async () => null,
            create: async (data) => ({
              ...nuevoUsuario,
              ...data,
              getRoles: async () => [{ nombre: 'Candidato' }],
            }),
          },
          CandidatoPerfil: {
            create: async (data) => ({ id: 5, ...data }),
          },
          Rol: {
            findOne: async () => ({ id: 1, nombre: 'Candidato' }),
          },
          UsuarioRol: {
            create: async () => ({}),
          },
          RefreshToken: {
            create: async () => ({}),
          },
        }),
        bcrypt: { hash: async (pw, salt) => '$2b$10$hasheado' },
        jsonwebtoken: { sign: () => 'tok-registro-ok' },
        crypto: {
          randomBytes: () => Buffer.from('b'.repeat(32)),
          createHash: () => ({
            update: () => ({ digest: () => 'mock-refresh-hash' }),
          }),
        },
      };

      withMocks(mocks, (controller) => {
        const req = {
          body: {
            dni: '12345678',
            email: 'nuevo@mail.com',
            password: 'MiPassword1',
            confirmPassword: 'MiPassword1',
          },
        };
        const res = makeRes();
        return controller.registrar(req, res).then(() => {
          assert.strictEqual(res.statusCode, 201);
          // Token ya no está en el body — está en cookies
          assert.strictEqual(res.body.token, undefined);
          assert.ok(res.cookies.agora_at, 'debe setear access token cookie');
          assert.ok(res.cookies.agora_rt, 'debe setear refresh token cookie');
          assert.strictEqual(res.body.usuario.dni, '12345678');
          assert.strictEqual(res.body.usuario.email, 'nuevo@mail.com');
          assert.strictEqual(res.body.usuario.rol, 'Candidato');
          console.log('✔ registro exitoso');
          hecho();
        });
      });
    })();
  }));

  // ── 2. Registro con DNI duplicado ────────────────────────────
  corridas.push(new Promise(hecho => {
    (function testRegistroDniDuplicado() {
      const existente = { id: 1, dni: '12345678', email: 'otro@mail.com' };

      const mocks = {
        [path.join(__dirname, '..', 'src', 'models', 'index.js')]: modelsBaseMock({
          Usuario: { findOne: async () => existente },
        }),
        bcrypt: { hash: async () => 'hash' },
        jsonwebtoken: { sign: () => 'tok' },
        crypto: {
          randomBytes: () => Buffer.from('b'.repeat(32)),
          createHash: () => ({
            update: () => ({ digest: () => 'h' }),
          }),
        },
      };

      withMocks(mocks, (controller) => {
        const req = {
          body: {
            dni: '12345678',
            email: 'nuevo@mail.com',
            password: 'MiPassword1',
            confirmPassword: 'MiPassword1',
          },
        };
        const res = makeRes();
        return controller.registrar(req, res).then(() => {
          assert.strictEqual(res.statusCode, 409);
          assert.ok(res.body.error.includes('DNI'));
          console.log('✔ registro con DNI duplicado → 409');
          hecho();
        });
      });
    })();
  }));

  // ── 3. Registro con passwords que no coinciden ──────────────
  corridas.push(new Promise(hecho => {
    (function testRegistroPasswordsNoCoinciden() {
      withMocks({
        [path.join(__dirname, '..', 'src', 'models', 'index.js')]: modelsBaseMock(),
        bcrypt: {},
        jsonwebtoken: {},
        crypto: {
          randomBytes: () => Buffer.from('b'.repeat(32)),
          createHash: () => ({
            update: () => ({ digest: () => 'h' }),
          }),
        },
      }, (controller) => {
        const req = {
          body: {
            dni: '12345678',
            email: 'nuevo@mail.com',
            password: 'MiPassword1',
            confirmPassword: 'OtraPassword',
          },
        };
        const res = makeRes();
        return controller.registrar(req, res).then(() => {
          assert.strictEqual(res.statusCode, 400);
          assert.ok(res.body.error.includes('coinciden'));
          console.log('✔ registro con passwords diferentes → 400');
          hecho();
        });
      });
    })();
  }));

  // ── 4. Obtener perfil existente ──────────────────────────────
  corridas.push(new Promise(hecho => {
    (function testObtenerPerfil() {
      const perfilMock = {
        id: 5,
        usuarioId: 10,
        nombre: 'Juan',
        apellido: 'Pérez',
        celular: '11 5555-1234',
        jurisdiccion: 'Salta',
        ciudad: 'Salta',
        estadoPerfil: 'Pre-aprobado',
        porcentajeCompletitud: 60,
        usuario: {
          email: 'juan@mail.com',
          dni: '12345678',
          rol: 'Candidato',
          fecha_registro: new Date(),
        },
      };

      const mocks = {
        [path.join(__dirname, '..', 'src', 'models', 'index.js')]: modelsBaseMock({
          CandidatoPerfil: {
            findOne: async () => perfilMock,
          },
        }),
      };

      withCandidatosMocks(mocks, (controller) => {
        const req = { usuario: { id: 10, rol: 'Candidato' } };
        const res = makeRes();
        return controller.obtenerPerfil(req, res).then(() => {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(res.body.nombre, 'Juan');
          assert.strictEqual(res.body.usuario.email, 'juan@mail.com');
          console.log('✔ obtener perfil');
          hecho();
        });
      });
    })();
  }));

  // ── 5. Actualizar perfil con datos parciales ─────────────────
  corridas.push(new Promise(hecho => {
    (function testActualizarPerfil() {
      let perfilActual = {
        id: 5,
        usuarioId: 10,
        nombre: null,
        apellido: null,
        celular: null,
        jurisdiccion: null,
        ciudad: null,
        discapacidadVisual: null,
        condicionVisual: null,
        tieneCud: null,
        nivelEducativo: null,
        autonomia: null,
        vinculoTecnologia: null,
        busquedaFormacion: null,
        busquedaEmpleo: null,
        estadoPerfil: 'Pendiente',
        porcentajeCompletitud: 0,
      };

      const mocks = {
        [path.join(__dirname, '..', 'src', 'models', 'index.js')]: modelsBaseMock({
          CandidatoPerfil: {
            findOne: async () => perfilActual,
          },
          Usuario: {
            update: async () => [1],
          },
        }),
      };

      withCandidatosMocks(mocks, (controller) => {
        const req = {
          usuario: { id: 10, rol: 'Candidato' },
          body: {
            nombre: 'Juan',
            apellido: 'Pérez',
            celular: '11 5555-1234',
          },
        };
        const res = makeRes();

        perfilActual.update = async function (data) {
          Object.assign(this, data);
          return this;
        };

        return controller.actualizarPerfil(req, res).then(() => {
          assert.strictEqual(res.statusCode, 200);
          assert.ok(res.body.porcentajeCompletitud >= 0);
          assert.ok(res.body.mensaje.includes('actualizado'));
          console.log('✔ actualizar perfil con datos parciales');
          hecho();
        });
      });
    })();
  }));

  // ── 6. Obtener completitud ───────────────────────────────────
  corridas.push(new Promise(hecho => {
    (function testObtenerCompletitud() {
      const perfilConDatos = {
        id: 5,
        porcentajeCompletitud: 60,
        estadoPerfil: 'Pre-aprobado',
        nombre: 'Juan',
        apellido: 'Pérez',
        celular: '11 5555-1234',
        jurisdiccion: 'Salta',
        ciudad: 'Salta',
        discapacidadVisual: 'Baja visión',
        condicionVisual: 'Progresiva',
        tieneCud: 'Sí',
        nivelEducativo: null,
        autonomia: null,
        vinculoTecnologia: null,
        busquedaFormacion: null,
        busquedaEmpleo: null,
        fechaNacimiento: null,
        genero: null,
      };

      const mocks = {
        [path.join(__dirname, '..', 'src', 'models', 'index.js')]: modelsBaseMock({
          CandidatoPerfil: {
            findOne: async () => perfilConDatos,
          },
        }),
      };

      withCandidatosMocks(mocks, (controller) => {
        const req = {
          usuario: { id: 10, rol: 'Candidato' },
        };
        const res = makeRes();
        return controller.obtenerCompletitud(req, res).then(() => {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(typeof res.body.porcentajeCompletitud, 'number');
          assert.ok(Array.isArray(res.body.camposFaltantes));
          console.log('✔ obtener completitud con campos faltantes');
          hecho();
        });
      });
    })();
  }));

  await Promise.all(corridas);
  console.log('Flujo-completo tests completed');
}

module.exports = { runTests };
