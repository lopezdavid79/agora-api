# Ágora Argentina — Backend API

API REST del programa **Ágora Argentina**, pensada para la inclusión laboral y formación profesional de personas con discapacidad visual.

---

## Índice

1. [Visión general del sistema](#visión-general-del-sistema)
2. [Las 4 etapas del proyecto](#las-4-etapas-del-proyecto)
3. [Requerimientos vs Implementación actual](#requerimientos-vs-implementación-actual)
4. [Stack tecnológico](#stack-tecnológico)
5. [Quick start](#quick-start)
6. [Variables de entorno](#variables-de-entorno)
7. [Arquitectura del código](#arquitectura-del-código)
8. [API — Endpoints](#api--endpoints)
9. [Base de datos](#base-de-datos)
10. [Autenticación y autorización](#autenticación-y-autorización)
11. [Flujo completo de navegación](#flujo-completo-de-navegación)
12. [Tests](#tests)
13. [Recomendaciones de mejora](#recomendaciones-de-mejora)
14. [Notas técnicas](#notas-técnicas)

---

## Visión general del sistema

El Programa Ágora Argentina busca eliminar barreras tecnológicas y ofrecer un entorno profesional donde cada usuario pueda autogestionar su camino hacia el empleo. La plataforma debe ser:

- **Totalmente accesible** — diseñada desde sus cimientos para lectores de pantalla (NVDA, JAWS) y navegación por teclado.
- **Centralizada** — reemplazar herramientas externas (Google Forms, planillas) con un sistema propio.
- **Segura** — cifrado de datos sensibles, control de acceso por roles, auditoría de documentos.

---

## Las 4 etapas del proyecto

El proyecto completo se divide en 4 fases progresivas:

| Fase | Descripción | Estado |
|------|-------------|--------|
| **1. Gestión de Perfiles y Documentación** | Registro, validación, carga de documentos, panel de gestión. | ✅ **Completada (Fase 1)** |
| **2. Gestión de Cursos y Formación** | Capacitaciones, inscripciones, reportes de progreso. | 🔴 Pendiente |
| **3. Gestión de Entrevistas** | Coordinación de encuentros, calendarios, seguimiento. | 🔴 Pendiente |
| **4. Perfil Profesional y Conexión Laboral** | Constructor de CV, filtros para reclutadores. | 🔴 Pendiente |

Esta documentación cubre la **Fase 1** completa.

---

## Requerimientos vs Implementación actual

### 📋 Leyenda

| Icono | Significado |
|-------|-------------|
| ✅ | Implementado |
| 🟡 | Implementación parcial |
| 🔴 | No implementado |
| ⚪ | No aplica / futuro |

### 1. Acceso y Gestión de Identidad

| Requerimiento | Estado | Notas |
|---------------|--------|-------|
| Login con email + password | ✅ | `POST /api/auth/login` |
| Login con DNI | ✅ | Detecta automáticamente si es email o DNI |
| Registro de nuevo candidato | ✅ | `POST /api/auth/registro` con validaciones |
| Multi-rol (Gestor también puede ser Candidato) | 🔴 | Modelo con un solo rol fijo — pendiente refactor |
| Recuperación de contraseña solo por gestor | 🔴 | Solo existe autoservicio con contraseña actual |
| Preferencias visuales antes del login | 🔴 | Pendiente |

### 2. Portal del Candidato

| Requerimiento | Estado | Notas |
|---------------|--------|-------|
| Carga por etapas (secciones) | 🟡 | El modelo tiene todos los campos; el PUT actualiza todo junto |
| Indicador de porcentaje de completitud | ✅ | `GET /perfil/completitud` devuelve % y campos faltantes |
| 15 campos requeridos para completitud | ✅ | Definidos en `CandidatoPerfil` |
| Niveles de validación (Pendiente / Pre-aprobado / Aprobado) | ✅ | ENUM completo + endpoints de cambio |
| Subida de documentos (DNI, CUD, CV) | ✅ | Con validación MIME, multer, 5MB límite |
| Visor de documentos integrado | ✅ | `GET /documentos/:id/descargar` sirve archivos |
| Papelera de seguridad (30 días) | ✅ | Soft-delete con `deletedAt` |
| Límites de carga configurables | 🔴 | Pendiente (Gestor Técnico) |

### 3. Centro de Gestión (SSC - Panel Administrativo)

| Requerimiento | Estado | Notas |
|---------------|--------|-------|
| Autenticación con roles | ✅ | `verificarToken` + `soloRoles()` |
| Roles: Candidato, Gestor, Administrador | ✅ | Definidos y funcionales |
| Buscador avanzado con filtros | ✅ | Cualquier campo del perfil, con AND/OR |
| Lógica AND/OR en búsqueda | ✅ | Parámetro `?modo=AND` / `?modo=OR` |
| Exportación a Excel con enlaces a documentos | ✅ | `exceljs` con links firmados |
| Ficha de candidato con documentos | ✅ | Perfil + docs + notas + notificaciones |
| Cambio de estado de validación | ✅ | `PUT /candidatos/:id/estado` |
| Notas privadas con adjuntos | 🟡 | Notas internas funcionales; adjuntos pendientes |
| Envío de notificaciones a usuarios | ✅ | `POST /notificaciones` para Gestor+ |
| Observación de perfil incompleto | ✅ | Alerta naranja configurable por gestor |

### 4. Documentos y Auditoría

| Requerimiento | Estado | Notas |
|---------------|--------|-------|
| Subida de archivos con validación MIME real | ✅ | `fileFilter` en multer, 6 tipos permitidos |
| Visor de documentos en el navegador | ✅ | `res.sendFile` con verificación de permisos |
| Soft delete con 30 días de retención | ✅ | `deletedAt` + mensaje al usuario |
| Límites de tamaño/cantidad configurables | 🔴 | Pendiente (Gestor Técnico) |
| Registro de auditoría (quién vio qué) | ✅ | Modelo `LogAuditoria` + registro en DB al descargar documentos |
| Integración Google Drive (backup) | 🔴 | Pendiente (Fase futura) |

### 5. Notificaciones

| Requerimiento | Estado | Notas |
|---------------|--------|-------|
| Notificaciones in-app | ✅ | CRUD completo |
| Polling cada 10 min (endpoint liviano) | ✅ | `GET /notificaciones/nuevas?desde=ISO` |
| Marcar como leídas | ✅ | `PUT /notificaciones/:id/leer` |
| Crear notificación (Gestor+) | ✅ | `POST /notificaciones` con validación de destinatario |

### 6. Accesibilidad y Personalización

| Requerimiento | Estado | Notas |
|---------------|--------|-------|
| Modo oscuro / claro | ✅ | Modelo `PreferenciaUsuario` + endpoint `PUT /api/preferencias` |
| Ajuste de tamaño de fuente | ✅ | 3 niveles: normal, grande, muy_grande |
| Alto contraste | ✅ | Disponible en modelo y endpoint |
| Persistencia de preferencias | ✅ | Por usuario vía upsert |
| Navegación por teclado | 🔴 | Compete al frontend |
| HTML semántico + ARIA | 🔴 | Compete al frontend |
| WCAG 2.2 nivel AA/AAA | 🔴 | Compete al frontend |

### 7. Administración de Datos Maestros

| Requerimiento | Estado | Notas |
|---------------|--------|-------|
| CRUD de países, provincias, ciudades | ✅ | Modelo `Catalogo` con 9 tipos |
| CRUD de tipos de discapacidad | ✅ | Incluido en Catálogo |
| CRUD de habilidades técnicas | ✅ | Incluido en Catálogo |
| CRUD de niveles educativos | ✅ | Incluido en Catálogo |
| Deshabilitar (no eliminar) opciones en uso | ✅ | DELETE validado; método `deshabilitar` separado |
| Consultar usuarios afectados por deshabilitado | ✅ | `GET /catalogos/:id/usuarios-afectados` |
| Notificación masiva a usuarios afectados | 🔴 | Pendiente |

### 8. Gestión de Usuarios

| Requerimiento | Estado | Notas |
|---------------|--------|-------|
| Listar usuarios con filtros | ✅ | Búsqueda multi-campo + paginación |
| Suspender / Reactivar cuentas | ✅ | Con protección de auto-suspensión |
| Cambiar rol de usuario | ✅ | Solo Administrador |

### 9. Seguridad

| Requerimiento | Estado | Notas |
|---------------|--------|-------|
| Autenticación JWT | ✅ | `jsonwebtoken` |
| Contraseñas hasheadas con bcrypt | ✅ | Cost factor 10 |
| Validación de entrada (express-validator) | ✅ | En auth y perfil |
| CORS restringido | ✅ | Configurado por `FRONTEND_URL` |
| Cifrado a nivel de campo (datos sensibles) | 🔴 | Pendiente |
| Protección de archivos (vista intermediaria) | ✅ | `GET /documentos/:id/descargar` verifica permisos |
| Helmet (seguridad HTTP headers) | ✅ | Implementado |

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js |
| Framework | Express 4.19 |
| ORM | Sequelize 6.37 |
| Base de datos | MySQL 8+ |
| Autenticación | JWT + bcrypt |
| Validación | express-validator |
| Seguridad HTTP | Helmet |
| Subida archivos | Multer (disk storage local) |
| Exportación Excel | exceljs |
| Testing | Node assert (minimal, sin dependencias extra) |

---

## Quick start

```bash
# 1. Clonar e instalar
npm install

# 2. Configurar .env (ver abajo)

# 3. Iniciar (crea tablas automáticamente si no existen)
npm start        # o: npm run dev (nodemon)
```

El servidor arranca en `http://localhost:3000`.

---

## Variables de entorno (`.env`)

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `DB_HOST` | Sí | `localhost` | Host de MySQL |
| `DB_PORT` | Sí | `3306` | Puerto de MySQL |
| `DB_NAME` | Sí | — | Nombre de la base de datos |
| `DB_USER` | Sí | — | Usuario de MySQL |
| `DB_PASS` | No | — | Contraseña de MySQL |
| `JWT_SECRET` | Sí | — | Secreto para firmar tokens JWT |
| `JWT_EXPIRES_IN` | No | `8h` | Duración del token (ej: `8h`, `7d`) |
| `FRONTEND_URL` | No | `http://localhost:5173` | Origen permitido por CORS |

---

## Arquitectura del código

```
src/
├── server.js                      # Punto de entrada
├── app.js                         # Configuración de Express (middlewares, rutas)
├── config/
│   └── database.js                # Conexión Sequelize a MySQL
├── models/
│   ├── index.js                   # Define asociaciones + Documento, Notificacion, NotaInterna
│   ├── Usuario.js                 # Modelo de usuarios
│   ├── CandidatoPerfil.js         # Perfiles de candidatos
│   ├── Catalogo.js                # Datos maestros (países, habilidades, etc.)
│   ├── PreferenciaUsuario.js      # Preferencias de accesibilidad (modo oscuro, fuente)
│   └── LogAuditoria.js            # Registro de auditoría de documentos
├── controllers/
│   ├── auth.controller.js         # Login (DNI/email), Registro, /me
│   ├── candidatos.controller.js   # Perfil, completitud
│   ├── password.controller.js     # Cambio de contraseña
│   ├── documentos.controller.js   # Subir, listar, eliminar (soft), descargar
│   ├── notificaciones.controller.js # CRUD, polling, marcar leídas
│   ├── catalogos.controller.js    # CRUD con integridad referencial
│   ├── gestor.controller.js       # SSC: búsqueda AND/OR, Excel, ficha, estado, notas, observación
│   ├── usuarios.controller.js     # Listar, suspender, reactivar, cambiar rol
│   └── preferencias.controller.js # Preferencias de accesibilidad
├── middlewares/
│   ├── auth.middleware.js         # verificarToken + soloRoles
│   └── upload.middleware.js       # Multer con diskStorage + validación MIME
├── routes/
│   ├── auth.routes.js             # /api/auth/*
│   ├── candidatos.routes.js       # /api/candidatos/*
│   ├── documentos.routes.js       # /api/documentos/*
│   ├── notificaciones.routes.js   # /api/notificaciones/*
│   ├── catalogos.routes.js        # /api/catalogos/*
│   ├── gestor.routes.js           # /api/gestor/* (SSC + usuarios)
│   └── preferencias.routes.js     # /api/preferencias/*
├── storage/documentos/            # Archivos subidos (gitignored)
└── test/
    ├── run-tests.js               # Runner principal
    ├── auth.test.js               # Tests de login (5 casos)
    └── flujo-completo.test.js     # Tests de registro + perfil (6 casos)
```

---

## API — Endpoints

### Auth — `/api/auth`

| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| POST | `/api/auth/registro` | ❌ | — | Registrar nuevo candidato |
| POST | `/api/auth/login` | ❌ | — | Iniciar sesión (email o DNI) |
| GET | `/api/auth/me` | ✅ | Todos | Datos del usuario logueado |
| PUT | `/api/auth/cambiar-password` | ✅ | Todos | Cambiar contraseña |
| POST | `/api/auth/logout` | ❌ | — | Cerrar sesión (solo mensaje) |

#### POST `/api/auth/registro`

**Body:**
```json
{
  "dni": "12345678",
  "email": "candidato@ejemplo.com",
  "password": "MiPassword1",
  "confirmPassword": "MiPassword1"
}
```

**Validaciones:**
- `dni` — requerido, único
- `email` — formato válido, único
- `password` — mínimo 8 caracteres, 1 mayúscula, 1 número
- `confirmPassword` — debe coincidir con password

**Respuesta 201:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 1,
    "email": "candidato@ejemplo.com",
    "dni": "12345678",
    "rol": "Candidato"
  }
}
```

**Errores:**
- `400` — validación (campos faltantes, passwords no coinciden)
- `409` — DNI o email ya registrados

Al registrarse se crea automáticamente un `CandidatoPerfil` vacío con estado `Pendiente` y 0% de completitud.

#### POST `/api/auth/login`

**Body:**
```json
{
  "email": "candidato@ejemplo.com",
  "password": "miPassword123"
}
```
El campo `email` acepta tanto un email como un número de DNI. El sistema detecta automáticamente cuál es.

**Respuesta 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 1,
    "email": "candidato@ejemplo.com",
    "rol": "Candidato",
    "nombre": "Sandra",
    "apellido": "Polutranka",
    "estadoPerfil": "Pendiente"
  }
}
```

**Errores:**
- `400` — validación (email/DNI vacío, password vacío)
- `401` — credenciales incorrectas
- `403` — cuenta deshabilitada

> El token JWT incluye `id`, `email` y `rol`. Se envía como `Authorization: Bearer <token>`.

#### GET `/api/auth/me`

Requiere token. Devuelve el usuario completo (sin password) con su perfil asociado.

#### PUT `/api/auth/cambiar-password`

Requiere token.

**Body:**
```json
{
  "passwordActual": "vieja123",
  "passwordNueva": "NuevaSegura456"
}
```

Requisitos: mínimo 8 caracteres, al menos una mayúscula, al menos un número.

---

### Candidatos — `/api/candidatos`

| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| GET | `/api/candidatos/perfil` | ✅ | Candidato, Gestor, Admin | Obtener perfil propio |
| PUT | `/api/candidatos/perfil` | ✅ | Solo Candidato | Actualizar perfil propio |
| GET | `/api/candidatos/perfil/completitud` | ✅ | Candidato, Gestor, Admin | % de completitud + campos faltantes |

#### GET `/api/candidatos/perfil`

Devuelve el perfil completo del candidato logueado, incluyendo datos del usuario asociado (email, dni, rol).

#### PUT `/api/candidatos/perfil`

El candidato actualiza sus datos. Campos bloqueados (no modificables por el candidato): `estadoPerfil`, `usuarioId`, `porcentajeCompletitud`.

Si el perfil ya fue **Aprobado**, solo un gestor puede modificarlo (devuelve 403).

Al actualizar, recalcula automáticamente el % de completitud.

#### GET `/api/candidatos/perfil/completitud`

**Respuesta:**
```json
{
  "porcentajeCompletitud": 60,
  "estadoPerfil": "Pendiente",
  "camposFaltantes": ["celular", "fechaNacimiento", "genero", ...]
}
```

Los **15 campos requeridos** para la completitud son:

| # | Campo | Descripción |
|---|-------|-------------|
| 1 | `nombre` | Nombre |
| 2 | `apellido` | Apellido |
| 3 | `celular` | Teléfono celular |
| 4 | `fechaNacimiento` | Fecha de nacimiento |
| 5 | `genero` | Género |
| 6 | `jurisdiccion` | Provincia / Jurisdicción |
| 7 | `ciudad` | Ciudad |
| 8 | `discapacidadVisual` | Tipo de discapacidad visual |
| 9 | `condicionVisual` | Condición visual específica |
| 10 | `tieneCud` | Posee Certificado Único de Discapacidad |
| 11 | `nivelEducativo` | Nivel educativo alcanzado |
| 12 | `autonomia` | Nivel de autonomía |
| 13 | `vinculoTecnologia` | Vínculo con la tecnología |
| 14 | `busquedaFormacion` | Busca formación |
| 15 | `busquedaEmpleo` | Busca empleo |

---

### Documentos — `/api/documentos`

| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| GET | `/api/documentos` | ✅ | Candidato (propios) / Gestor+ | Listar documentos activos |
| POST | `/api/documentos/subir` | ✅ | Solo Candidato | Subir archivo |
| DELETE | `/api/documentos/:id` | ✅ | Dueño o Gestor+ | Soft-delete (papelera 30 días) |
| GET | `/api/documentos/:id/descargar` | ✅ | Dueño o Gestor+ | Descargar con auditoría |

#### POST `/api/documentos/subir`

Requiere token (Candidato). Multipart form-data.

**Campos:**
- `archivo` — archivo a subir
- `tipoDocumento` — `CV`, `DNI`, `CUD`, `Otro`

**Validación MIME:** solo PDF, JPEG, PNG, DOC, DOCX, TXT. Límite: 5MB.

**Respuesta 201:** datos del documento creado.

#### GET `/api/documentos`

Lista documentos activos (no eliminados). El candidato solo ve los suyos. Gestor+ puede filtrar por `?perfilId=`.

#### DELETE `/api/documentos/:id`

Soft-delete: marca `deletedAt` con la fecha actual. El archivo físico NO se elimina. El sistema informa: *"Documento eliminado. Estará en la papelera por 30 días."*

#### GET `/api/documentos/:id/descargar`

Sirve el archivo. Verifica permisos. Si quien descarga es Gestor+, registra en console.log:`[AUDITORIA] Gestor {id} visualizó documento {id}`.

---

### Notificaciones — `/api/notificaciones`

| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| GET | `/api/notificaciones` | ✅ | Todos | Listar con paginación |
| GET | `/api/notificaciones/nuevas` | ✅ | Todos | Polling liviano (`?desde=ISO`) |
| POST | `/api/notificaciones` | ✅ | Gestor+ | Crear notificación |
| PUT | `/api/notificaciones/:id/leer` | ✅ | Dueño | Marcar como leída |

#### GET `/api/notificaciones`

Paginación: `?page=1&limit=20` (defaults). Ordenadas por fecha DESC.

#### GET `/api/notificaciones/nuevas`

Parámetro `?desde=ISO`. Devuelve solo IDs de no leídas posteriores a esa fecha. Respuesta liviana:
```json
{ "cantidad": 3, "ids": [12, 15, 18] }
```

#### POST `/api/notificaciones`

**Body:** `{ usuarioId, asunto, mensaje }`

Crea notificación para el destinatario. Valida que el usuario exista.

---

### Catálogos — `/api/catalogos`

| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| GET | `/api/catalogos?tipo=X` | ✅ | Todos | Listar por tipo |
| GET | `/api/catalogos?tipo=X&incluirInactivos=true` | ✅ | Todos | Incluir deshabilitados |
| POST | `/api/catalogos` | ✅ | Gestor+ | Crear ítem |
| PUT | `/api/catalogos/:id` | ✅ | Gestor+ | Editar nombre/orden |
| DELETE | `/api/catalogos/:id` | ✅ | Gestor+ | Eliminar (con integridad) |
| PUT | `/api/catalogos/:id/deshabilitar` | ✅ | Gestor+ | Marcar como inactivo |
| GET | `/api/catalogos/:id/usuarios-afectados` | ✅ | Gestor+ | Perfiles que usan este valor |

**Tipos disponibles:** `pais`, `provincia`, `ciudad`, `tipo_discapacidad`, `condicion_visual`, `habilidad_tecnica`, `nivel_educativo`, `carrera`, `beneficio_social`.

**Integridad en DELETE:** si hay perfiles usando el valor, responde 409 y sugiere deshabilitar.

---

### SSC (Centro de Gestión) — `/api/gestor`

Todas las rutas requieren token y rol Gestor+ (excepto cambiar rol que requiere Administrador).

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/gestor/candidatos/buscar` | Búsqueda AND/OR con paginación |
| GET | `/api/gestor/candidatos/exportar` | Exportar Excel |
| GET | `/api/gestor/candidatos/:id` | Ficha completa del candidato |
| PUT | `/api/gestor/candidatos/:id/estado` | Cambiar validación |
| POST | `/api/gestor/candidatos/:id/notas` | Crear nota interna |
| GET | `/api/gestor/candidatos/:id/notas` | Listar notas |
| PUT | `/api/gestor/candidatos/:id/notas/:nid` | Editar nota |
| POST | `/api/gestor/candidatos/:id/observacion` | Marcar/limpiar alerta |
| GET | `/api/gestor/usuarios` | Listar usuarios |
| GET | `/api/gestor/usuarios/:id` | Ficha del usuario |
| PUT | `/api/gestor/usuarios/:id/suspender` | Suspender cuenta |
| PUT | `/api/gestor/usuarios/:id/reactivar` | Reactivar cuenta |
| PUT | `/api/gestor/usuarios/:id/rol` | Cambiar rol (solo Admin) |

#### GET `/api/gestor/candidatos/buscar?modo=AND&nombre=Juan&jurisdiccion=Salta&page=1&limit=20`

**Parámetros:**
- `modo` — `AND` (todos los filtros, default) u `OR` (al menos uno)
- Cualquier campo de `CandidatoPerfil` como filtro (26 campos permitidos en whitelist)
- `page`, `limit` — paginación

**Respuesta:**
```json
{
  "candidatos": [...],
  "total": 45,
  "page": 1,
  "totalPages": 3
}
```

#### GET `/api/gestor/candidatos/exportar?modo=AND&...`

Mismos filtros que búsqueda. Descarga `candidatos.xlsx` con columnas: Nombre, Apellido, DNI, Email, Celular, Ciudad, Jurisdicción, Nivel Educativo, Discapacidad Visual, Estado, % Completitud, y enlaces a DNI/CUD/CV.

#### GET `/api/gestor/candidatos/:id`

Ficha completa: perfil + usuario (email, dni, rol) + documentos activos + notas internas (con autor) + últimas 5 notificaciones.

#### PUT `/api/gestor/candidatos/:id/estado`

**Body:** `{ estado: "Pre-aprobado" }`

Estados válidos: `Pendiente`, `Pre-aprobado`, `Aprobado`. Al cambiar estado, recalcula % de completitud.

#### POST / PUT `/api/gestor/candidatos/:id/notas[/:nid]`

Notas internas: solo visibles para Gestor+. Al crear, registra `gestorId` del token. Al editar, verifica ownership (solo el autor o Admin pueden editar).

#### POST `/api/gestor/candidatos/:id/observacion`

**Body:** `{ observacion: "Falta cargar CUD" }` — marca alerta naranja.
Para limpiar: `{ observacion: null }`.

#### GET / PUT `/api/gestor/usuarios[/:id]`

Lista usuarios con búsqueda multi-campo (nombre, email, dni), filtro por rol y estado activo.

#### PUT `/api/gestor/usuarios/:id/suspender`

Suspende cuenta (`activo=false`). No permite auto-suspensión.

#### PUT `/api/gestor/usuarios/:id/rol`

Solo Administrador. No permite auto-cambio de rol.

---

### Preferencias de accesibilidad — `/api/preferencias`

| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| GET | `/api/preferencias` | ✅ | Todos | Obtener preferencias (crea con defaults si no existen) |
| PUT | `/api/preferencias` | ✅ | Todos | Actualizar preferencias (upsert) |

**Campos:**
- `modoOscuro` — boolean (default: false)
- `tamanoFuente` — `'normal'`, `'grande'`, `'muy_grande'` (default: 'normal')
- `altoContraste` — boolean (default: false)

**Ejemplo PUT:**
```json
{ "modoOscuro": true, "tamanoFuente": "grande" }
```

---

### Health — `/api/health`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | ❌ | Health check (`{"status":"ok"}`) |

---

## Base de datos

### Modelo relacional

```
usuarios (1) ──── (1) candidatos_perfil
usuarios (1) ──── (N) notificaciones
candidatos_perfil (1) ──── (N) documentos
candidatos_perfil (1) ──── (N) notas_internas
notas_internas (N) ──── (1) usuarios (gestor)
```

### Modelos implementados (Sequelize)

#### `usuarios`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | INT PK | auto_increment |
| dni | VARCHAR(20) | único |
| email | VARCHAR(100) | único |
| password | VARCHAR(255) | hash bcrypt |
| rol | ENUM('Candidato','Gestor','Administrador') | Default: Candidato |
| activo | BOOLEAN | Default: true |
| ultimo_acceso | TIMESTAMP | nullable |
| fecha_registro | TIMESTAMP | createdAt |

#### `candidatos_perfil`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | INT PK | auto_increment |
| usuario_id | INT FK | único |
| nombre, apellido, celular | VARCHAR | Datos personales |
| fecha_nacimiento | DATE | |
| genero | VARCHAR(50) | |
| pais_residencia, nacionalidad | VARCHAR(100) | |
| jurisdiccion, ciudad | VARCHAR(100) | |
| discapacidad_visual | VARCHAR(150) | Tipo de DV |
| condicion_visual | VARCHAR(100) | |
| otra_discapacidad | VARCHAR(10) | |
| descripcion_otra_disc | TEXT | |
| tiene_cud | VARCHAR(10) | Certificado Único de Discapacidad |
| beneficio_social | VARCHAR(150) | |
| tipo_escolaridad | VARCHAR(100) | |
| nivel_educativo | VARCHAR(100) | |
| carrera_estudios | TEXT | |
| braille | VARCHAR(10) | |
| autonomia | TEXT | |
| apoyos_desplazamiento | TEXT | |
| vinculo_tecnologia | TEXT | |
| herramientas_tecnologicas | TEXT | |
| idiomas | TEXT | |
| emprendimiento | TEXT | |
| busqueda_formacion | VARCHAR(10) | |
| tipo_formacion_buscada | TEXT | |
| busqueda_empleo | VARCHAR(10) | |
| tiene_trabajo_actual | VARCHAR(10) | |
| area_trabajo_actual | VARCHAR(150) | |
| informacion_adicional | TEXT | |
| observacion_perfil | TEXT | Alerta del gestor, nullable |
| fecha_observacion | TIMESTAMP | nullable |
| estado_perfil | ENUM('Pendiente','Pre-aprobado','Aprobado') | Default: Pendiente |
| porcentaje_completitud | TINYINT UNSIGNED | Default: 0 |
| fecha_creacion / fecha_actualizacion | TIMESTAMP | timestamps |

#### `documentos`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | INT PK | auto_increment |
| perfil_id | INT FK | del candidato |
| tipo_documento | ENUM('CV','DNI','CUD','Otro') | Default: Otro |
| url_drive | TEXT | Ruta local al archivo |
| nombre_archivo | VARCHAR(255) | Nombre original |
| fecha_subida | TIMESTAMP | createdAt |
| deleted_at | TIMESTAMP | nullable (soft delete) |

#### `notificaciones`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | INT PK | auto_increment |
| usuario_id | INT FK | destinatario |
| emisor_id | INT FK | nullable (quién envía) |
| asunto | VARCHAR(255) | |
| mensaje | TEXT | |
| leida | BOOLEAN | Default: false |
| fecha_envio | TIMESTAMP | createdAt |
| fecha_lectura | TIMESTAMP | nullable |

#### `notas_internas`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | INT PK | auto_increment |
| perfil_id | INT FK | perfil del candidato |
| gestor_id | INT FK | gestor que escribe |
| contenido | TEXT | |
| fecha_creacion | TIMESTAMP | createdAt |
| fecha_edicion | TIMESTAMP | nullable |

#### `catalogos`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | INT PK | auto_increment |
| tipo | ENUM(9 tipos) | Discrimina el tipo de catálogo |
| nombre | VARCHAR(200) | Valor visible |
| activo | BOOLEAN | Default: true |
| orden | INT | Default: 0 |
| fecha_creacion / fecha_actualizacion | TIMESTAMP | timestamps |

#### `preferencias_usuario`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | INT PK | auto_increment |
| usuario_id | INT FK | único |
| modo_oscuro | BOOLEAN | Default: false |
| tamano_fuente | ENUM('normal','grande','muy_grande') | Default: normal |
| alto_contraste | BOOLEAN | Default: false |
| fecha_actualizacion | TIMESTAMP | updatedAt |

#### `auditoria_documentos`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | INT PK | auto_increment |
| usuario_id | INT FK | quien accedió |
| documento_id | INT FK | nullable |
| accion | ENUM('Vista','Descarga','Subida','Eliminación') | |
| ip_origen | VARCHAR(45) | nullable |
| detalle | TEXT | nullable |
| fecha | TIMESTAMP | createdAt |

---

## Autenticación y autorización

### Flujo de registro

```
POST /api/auth/registro
       │
       ▼
  Validar body (express-validator)
       │
       ├── Passwords no coinciden → 400
       │
       ▼
  Verificar DNI único → ¿Ya existe? → 409
  Verificar email único → ¿Ya existe? → 409
       │
       ▼
  bcrypt.hash(password, 10)
       │
       ▼
  Crear Usuario { dni, email, password, rol: 'Candidato', activo: true }
  Crear CandidatoPerfil { usuarioId, estado: 'Pendiente', %: 0 }
       │
       ▼
  Generar JWT { id, email, rol }
       │
       ▼
  Devolver { token, usuario: { id, email, dni, rol } } → 201
```

### Flujo de login

```
POST /api/auth/login
       │
       ▼
  Validar body (express-validator)
       │
       ▼
  ¿El input contiene @?
       │
       ├── Sí → buscar por email
       ├── No → buscar por dni
       │
       ▼
  ¿Usuario encontrado?
       │
       ├── No → 401
       │
       ▼
  ¿Usuario activo?
       │
       ├── No → 403
       │
       ▼
  bcrypt.compare(password, hash)
       │
       ├── No coincide → 401
       │
       ▼
  Generar JWT { id, email, rol } → firmado con JWT_SECRET
       │
       ▼
  Actualizar ultimoAcceso (async, no bloquea)
       │
       ▼
  Devolver { token, usuario: { id, email, rol, nombre, apellido, estadoPerfil } }
```

### Middlewares

| Middleware | Función |
|-----------|---------|
| `verificarToken` | Extrae el token del header `Authorization: Bearer <token>`, lo verifica y setea `req.usuario` |
| `soloRoles(...roles)` | Permite el acceso solo si `req.usuario.rol` está en la lista |

### Roles

| Rol | Descripción |
|-----|-------------|
| `Candidato` | Usuario del programa, gestiona su perfil y documentos |
| `Gestor` | Opera el SSC: busca, exporta, valida perfiles, agrega notas, envía notificaciones |
| `Administrador` | Acceso completo: además de Gestor, puede cambiar roles y suspender cuentas |

---

## Flujo completo de navegación

### Registro y primeros pasos (candidato)

```
1. POST /api/auth/registro        → crea cuenta + perfil vacío (Pendiente, 0%)
2. POST /api/auth/login           → login con DNI o email
3. GET  /api/candidatos/perfil    → ver perfil (vacío al principio)
4. PUT  /api/candidatos/perfil    → completar datos progresivamente
5. GET  /api/candidatos/perfil/completitud → ver % + qué falta
6. POST /api/documentos/subir     → subir DNI, CUD, CV
7. DELETE /api/documentos/:id     → eliminar con papelera de 30 días
```

### Gestión administrativa (gestor)

```
1. GET  /api/gestor/usuarios                → buscar usuarios
2. GET  /api/gestor/candidatos/buscar       → filtrar candidatos (AND/OR)
3. GET  /api/gestor/candidatos/:id          → ficha completa
4. PUT  /api/gestor/candidatos/:id/estado   → cambiar validación
5. POST /api/gestor/candidatos/:id/notas    → agregar nota interna
6. POST /api/notificaciones                 → enviar aviso al candidato
7. GET  /api/gestor/candidatos/exportar     → descargar Excel
8. POST /api/gestor/candidatos/:id/observacion → marcar perfil incompleto
```

### Administración del sistema (admin)

```
1. GET  /api/gestor/usuarios                → listar usuarios
2. PUT  /api/gestor/usuarios/:id/suspender  → suspender cuenta
3. PUT  /api/gestor/usuarios/:id/reactivar  → reactivar cuenta
4. PUT  /api/gestor/usuarios/:id/rol        → cambiar rol
5. POST /api/catalogos                      → crear/editar datos maestros
6. GET  /api/catalogos/:id/usuarios-afectados → ver impacto de cambios
```

---

## Tests

```
test/
├── run-tests.js               # Runner principal
├── auth.test.js               # Tests de login (5 casos)
└── flujo-completo.test.js     # Tests de registro + perfil (6 casos)
```

Ejecutar:
```bash
npm test
# o directamente:
node test/run-tests.js
```

### Tests existentes (13 casos)

**calcularCompletitud** (test unitario):
- Perfil vacío → 0%
- Perfil completo → 100%
- Perfil medio → ~50%

**auth.login** (5 casos con mocks):
- Login exitoso → 200 + token
- Password incorrecto → 401
- Usuario no existe → 401
- Login con DNI → 200
- Usuario inactivo → 403

**flujo-completo** (6 casos con mocks):
- Registro exitoso → 201 + token + perfil creado
- Registro con DNI duplicado → 409
- Registro con passwords diferentes → 400
- Obtener perfil → 200 con datos
- Actualizar perfil → 200 + recálculo de %
- Obtener completitud → 200 + campos faltantes

---

## Recomendaciones de mejora

Las recomendaciones detalladas están documentadas en `docs/recomendaciones-mejora.md`. Los puntos principales:

### Pendientes para Fase 1 actual

- [ ] **Multi-rol** — refactor del modelo Usuario para permitir M:N roles (un usuario puede ser Candidato y Gestor)
- [ ] **Recuperación de contraseña** — endpoint para que el gestor pueda resetear la contraseña de un candidato
- [ ] **Preferencias de accesibilidad** — modelo + endpoints para modo oscuro y tamaño de fuente persistentes
- [ ] **Registro de auditoría persistente** — modelo `LogAuditoria` en DB (hoy es solo console.log)
- [ ] **Notas con adjuntos** — relación Documento → NotaInterna para adjuntar archivos
- [ ] **Notificación masiva** — endpoint para notificar a todos los usuarios afectados por un cambio de catálogo
- [ ] **Límites configurables** — tamaño/cantidad de archivos gestionable por Gestor Técnico

### Fases futuras

- [ ] Gestión de cursos y formación (Fase 2)
- [ ] Gestión de entrevistas (Fase 3)
- [ ] Constructor de CV profesional + conexión laboral (Fase 4)
- [ ] Integración Google Drive para backup redundante
- [ ] Integración con IA (Gemini/OpenAI) para análisis de documentos
- [ ] Cifrado a nivel de campo para datos sensibles

---

## Notas técnicas

| Nota | Detalle |
|------|---------|
| **Sync automático** | Las tablas se crean al iniciar con `sequelize.sync({ force: false })`. No borra datos existentes, pero no altera tablas existentes — las columnas nuevas requieren migración manual o `{ alter: true }`. |
| **snake_case / camelCase** | DB usa snake_case; el código accede en camelCase gracias a `underscored: true` en Sequelize. |
| **CORS** | Configurado para `FRONTEND_URL` (default: `http://localhost:5173`, puerto de Vite). |
| **Soft delete** | Modelo `Documento` tiene `deletedAt`. Las queries filtran `{ deletedAt: null }`. El borrado físico no está implementado. |
| **Archivos subidos** | Se almacenan en `storage/documentos/`. No accesibles públicamente — se sirven a través de `GET /api/documentos/:id/descargar` con verificación de permisos. |
| **Stack real** | El documento original proponía Python + Django. Se implementó en Node.js + Express + Sequelize. Ver `docs/recomendaciones-mejora.md` para la tabla de equivalencias. |
| **Total endpoints** | 34 endpoints REST operativos en la Fase 1. |
