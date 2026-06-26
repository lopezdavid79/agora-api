const path = require('path');
const assert = require('assert');

/**
 * Mock response object that supports cookies.
 */
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

/**
 * Minimal helpers to mock require cache entries while loading the controller
 */
function withMocks(mocks, fn) {
  const resolved = {};
  const originals = {};
  try {
    // Install mocks into require.cache
    for (const [reqPath, mockExports] of Object.entries(mocks)) {
      const resolvedPath = require.resolve(reqPath, { paths: [path.join(__dirname, '..')] });
      resolved[reqPath] = resolvedPath;
      originals[resolvedPath] = require.cache[resolvedPath];
      // put a minimal Module-like object
      require.cache[resolvedPath] = { exports: mockExports };
    }

    // Ensure controller is loaded fresh
    const controllerPath = path.join(__dirname, '..', 'src', 'controllers', 'auth.controller.js');
    delete require.cache[require.resolve(controllerPath)];
    const controller = require(controllerPath);
    return fn(controller);
  } finally {
    // Restore original cache
    for (const [, resolvedPath] of Object.entries(resolved)) {
      if (originals[resolvedPath] === undefined) {
        delete require.cache[resolvedPath];
      } else {
        require.cache[resolvedPath] = originals[resolvedPath];
      }
    }
    // also clear controller from cache to avoid leaking mocks
    try { delete require.cache[require.resolve(path.join(__dirname, '..', 'src', 'controllers', 'auth.controller.js'))]; } catch (e) {}
  }
}

/**
 * Build mocks object with all the modules the controller imports.
 * Accepts overrides for specific mocks.
 */
function baseMocks(overrides = {}) {
  const defaults = {
    bcrypt: { compare: async () => true },
    jsonwebtoken: { sign: () => 'access-tok-mock' },
    crypto: {
      randomBytes: () => Buffer.from('a'.repeat(32)),
      createHash: () => ({
        update: () => ({ digest: () => 'mock-refresh-token-hash' }),
      }),
    },
      [path.join(__dirname, '..', 'src', 'config', 'database.js')]: {
        sequelize: {
          transaction: async (fn) => fn({}),
        },
      },
      [path.join(__dirname, '..', 'src', 'models', 'index.js')]: {
      Usuario: {},
      CandidatoPerfil: {},
      Rol: {},
      UsuarioRol: {},
      TokenReseteo: {},
      RefreshToken: {
        create: async () => ({}),
        findOne: async () => null,
        update: async () => {},
      },
    },
  };
  return { ...defaults, ...overrides };
}

async function runTests() {
  console.log('Running auth.login tests...\n');

  // ── Login successful ──────────────────────────────────────────
  (function testSuccessfulLogin() {
    const fakeUser = {
      id: 1,
      email: 'test@example.com',
      password: 'hashedpwd',
      rol: 'Candidato',
      activo: true,
      perfil: { nombre: 'Nombre', apellido: 'Apellido', estadoPerfil: 'COMPLETO' },
      update: function (data) { this.ultimoAcceso = data.ultimoAcceso; return Promise.resolve(this); },
      getRoles: async () => [{ nombre: 'Candidato' }],
    };

    const mocks = baseMocks({
      [path.join(__dirname, '..', 'src', 'models', 'index.js')]: {
        Usuario: { findOne: async () => fakeUser },
        CandidatoPerfil: {},
        Rol: {},
        UsuarioRol: {},
        TokenReseteo: {},
        RefreshToken: { create: async () => ({}) },
      },
    });

    withMocks(mocks, (controller) => {
      const req = { body: { email: 'test@example.com', password: 'secret' } };
      const res = makeRes();
      return controller.login(req, res).then(() => {
        assert.strictEqual(res.statusCode, 200);
        // Token NO debe estar en el body (ahora va en cookie)
        assert.strictEqual(res.body.token, undefined);
        // Debe tener el usuario en la respuesta
        assert.strictEqual(res.body.usuario.email, fakeUser.email);
        // Debe haber seteado cookies
        assert.ok(res.cookies.agora_at, 'access token cookie debe existir');
        assert.ok(res.cookies.agora_rt, 'refresh token cookie debe existir');
        console.log('  ✔ successful login returns usuario and sets cookies');
      });
    });
  })();

  // ── Wrong password ──────────────────────────────────────────
  (function testWrongPassword() {
    const fakeUser = { id: 2, email: 'a@b.com', password: 'hashed', rol: 'Candidato', activo: true };
    const mocks = baseMocks({
      bcrypt: { compare: async () => false },
      [path.join(__dirname, '..', 'src', 'models', 'index.js')]: {
        Usuario: { findOne: async () => fakeUser },
        CandidatoPerfil: {},
        Rol: {},
        UsuarioRol: {},
        TokenReseteo: {},
        RefreshToken: {},
      },
    });

    withMocks(mocks, (controller) => {
      const req = { body: { email: 'a@b.com', password: 'bad' } };
      const res = makeRes();
      return controller.login(req, res).then(() => {
        assert.strictEqual(res.statusCode, 401);
        assert.ok(res.body.error.includes('Credenciales'));
        console.log('  ✔ wrong password returns 401');
      });
    });
  })();

  // ── User not found ──────────────────────────────────────────
  (function testUserNotFound() {
    const mocks = baseMocks({
      [path.join(__dirname, '..', 'src', 'models', 'index.js')]: {
        Usuario: { findOne: async () => null },
        CandidatoPerfil: {},
        Rol: {},
        UsuarioRol: {},
        TokenReseteo: {},
        RefreshToken: {},
      },
    });

    withMocks(mocks, (controller) => {
      const req = { body: { email: 'no@user.com', password: 'x' } };
      const res = makeRes();
      return controller.login(req, res).then(() => {
        assert.strictEqual(res.statusCode, 401);
        assert.ok(res.body.error.includes('Credenciales'));
        console.log('  ✔ non-existing user returns 401');
      });
    });
  })();

  // ── Login with DNI ─────────────────────────────────────────
  (function testLoginWithDni() {
    const fakeUser = {
      id: 4,
      dni: '12345678',
      email: 'test@example.com',
      password: 'hashedpwd',
      rol: 'Candidato',
      activo: true,
      perfil: { nombre: 'DNI', apellido: 'User', estadoPerfil: 'Pre-aprobado' },
      update: function (data) { this.ultimoAcceso = data.ultimoAcceso; return Promise.resolve(this); },
      getRoles: async () => [{ nombre: 'Candidato' }],
    };

    const mocks = baseMocks({
      [path.join(__dirname, '..', 'src', 'models', 'index.js')]: {
        Usuario: { findOne: async () => fakeUser },
        CandidatoPerfil: {},
        Rol: {},
        UsuarioRol: {},
        TokenReseteo: {},
        RefreshToken: { create: async () => ({}) },
      },
    });

    withMocks(mocks, (controller) => {
      const req = { body: { email: '12345678', password: 'secret' } };
      const res = makeRes();
      return controller.login(req, res).then(() => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.token, undefined);
        assert.strictEqual(res.body.usuario.nombre, 'DNI');
        assert.ok(res.cookies.agora_at);
        console.log('  ✔ login with DNI succeeds and sets cookies');
      });
    });
  })();

  // ── Inactive user ───────────────────────────────────────────
  (function testInactiveUser() {
    const fakeUser = { id: 3, email: 'd@d.com', password: 'hashed', rol: 'Candidato', activo: false };
    const mocks = baseMocks({
      [path.join(__dirname, '..', 'src', 'models', 'index.js')]: {
        Usuario: { findOne: async () => fakeUser },
        CandidatoPerfil: {},
        Rol: {},
        UsuarioRol: {},
        TokenReseteo: {},
        RefreshToken: {},
      },
    });

    withMocks(mocks, (controller) => {
      const req = { body: { email: 'd@d.com', password: 'x' } };
      const res = makeRes();
      return controller.login(req, res).then(() => {
        assert.strictEqual(res.statusCode, 403);
        assert.ok(res.body.error.includes('deshabilitada'));
        console.log('  ✔ inactive user returns 403');
      });
    });
  })();

  // ── Refresh token success ────────────────────────────────────
  (function testRefreshSuccess() {
    const fakeUser = {
      id: 5, email: 'refresh@test.com', rol: 'Candidato', activo: true,
      perfil: { nombre: null, apellido: null, estadoPerfil: null },
      getRoles: async () => [{ nombre: 'Candidato' }],
    };

    const mockRecord = {
      usuarioId: 5,
      expiresAt: new Date(Date.now() + 3600000),
      usuario: fakeUser,
      update: async function () { return this; },
    };

    const mocks = baseMocks({
      [path.join(__dirname, '..', 'src', 'models', 'index.js')]: {
        Usuario: {
          findByPk: async () => fakeUser,
        },
        CandidatoPerfil: {},
        Rol: {},
        UsuarioRol: {},
        TokenReseteo: {},
        RefreshToken: {
          findOne: async () => mockRecord,
          create: async () => ({}),
          update: async () => {},
        },
      },
      [path.join(__dirname, '..', 'src', 'config', 'database.js')]: {
        sequelize: {
          transaction: async (fn) => {
            const t = {};
            await mockRecord.update({ revokedAt: new Date() }, { transaction: t });
            await Promise.resolve();
            return { data: 'ok' };
          },
        },
      },
    });

    withMocks(mocks, (controller) => {
      const req = { cookies: { agora_rt: 'some-refresh-token' } };
      const res = makeRes();
      return controller.refresh(req, res).then(() => {
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.body.usuario);
        assert.ok(res.cookies.agora_at);
        assert.ok(res.cookies.agora_rt);
        console.log('  ✔ refresh success returns usuario and new cookies');
      });
    });
  })();

  // ── Refresh without cookie ──────────────────────────────────
  (function testRefreshNoCookie() {
    const mocks = baseMocks({
      [path.join(__dirname, '..', 'src', 'models', 'index.js')]: {
        Usuario: {}, CandidatoPerfil: {}, Rol: {}, UsuarioRol: {},
        TokenReseteo: {}, RefreshToken: {},
      },
    });

    withMocks(mocks, (controller) => {
      const req = { cookies: {} };
      const res = makeRes();
      return controller.refresh(req, res).then(() => {
        assert.strictEqual(res.statusCode, 401);
        assert.ok(res.body.error.includes('Refresh token requerido'));
        console.log('  ✔ refresh without cookie returns 401');
      });
    });
  })();

  // ── Logout clears cookies ────────────────────────────────────
  (function testLogout() {
    const mocks = baseMocks({
      [path.join(__dirname, '..', 'src', 'models', 'index.js')]: {
        Usuario: {}, CandidatoPerfil: {}, Rol: {}, UsuarioRol: {},
        TokenReseteo: {},
        RefreshToken: {
          update: async () => {},
        },
      },
    });

    withMocks(mocks, (controller) => {
      const req = { cookies: { agora_rt: 'some-token' } };
      const res = makeRes();
      // pre-set some cookies to verify they get cleared
      res.cookies.agora_at = { value: 'x' };
      res.cookies.agora_rt = { value: 'y' };
      return controller.logout(req, res).then(() => {
        assert.strictEqual(res.statusCode, 200);
        // agor_at cleared
        assert.strictEqual(res.cookies.agora_at, undefined);
        // agora_rt cleared
        assert.strictEqual(res.cookies.agora_rt, undefined);
        console.log('  ✔ logout clears cookies');
      });
    });
  })();

  console.log('\nAuth tests completed');
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch(err => { console.error('Auth tests failed:', err); process.exit(1); });
}
