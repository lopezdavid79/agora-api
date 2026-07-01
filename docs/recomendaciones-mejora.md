# Recomendaciones de Mejora — Ágora Argentina

Análisis de brechas entre los requerimientos del sistema y el código actual, con recomendaciones priorizadas para la Fase 1.

---

## Resumen ejecutivo

El documento de requerimientos describe un sistema con login por DNI/email, multi-rol, subida de documentos con papelera de 30 días, búsqueda avanzada, notificaciones, exportación Excel, preferencias de accesibilidad y auditoría.

**El código actual (Node.js/Express) implementa aproximadamente un 20 % de esos requerimientos.** Las brechas más críticas están en la subida de archivos (hoy es un stub), el multi-rol (modelo con un solo rol fijo), el login por DNI, y la ausencia de búsqueda, notificaciones y auditoría.

Adicionalmente, el documento propone Python/Django pero el código real es Node.js/Express — discrepancia basal que asumimos como decisión ya tomada.

---

## Priorización

| Prioridad | Área | Impacto |
|-----------|------|---------|
| 🔴 Crítico | Funcionalidades bloqueantes para la Fase 1 | Sin esto el sistema no cumple el alcance mínimo |
| 🟡 Alta | Integridad, seguridad, cumplimiento del doc | Lo requiere el documento, afecta calidad |
| 🟢 Recomendado | Arquitectura y calidad de código | Mejora mantenibilidad a futuro |

---

## 🔴 Crítico — Funcionalidades bloqueantes

### 1. Login con DNI o email

**Requerimiento:** "Se puede ingresar usando el número de DNI o el correo electrónico, junto con una contraseña personal."

**Código actual:** Busca solo por email (`auth.controller.js`, línea 23).

**Acción:** Modificar `POST /api/auth/login` para detectar el tipo de credencial:
- Si contiene `@` → busca por email.
- Si no → busca por DNI.

**Archivos a modificar:** `src/controllers/auth.controller.js`

---

### 2. Multi-rol (un usuario con varios roles)

**Requerimiento:** "Algunas personas, como los gestores, también pueden ser candidatos. El sistema les permite alternar su vista."

**Código actual:** `Usuario.js` tiene un `ENUM('Candidato', 'Gestor', 'Administrador')` — un solo rol fijo por usuario.

**Acción:**

1. Crear tabla `roles` con los valores del sistema.
2. Crear tabla puente `usuario_rol` (usuarioId, rolId) — un usuario puede tener 1..N registros.
3. Agregar endpoint `POST /api/auth/cambiar-vista` que devuelva un nuevo JWT con el rol activo seleccionado.
4. Modificar `auth.middleware.js` para leer roles desde la tabla puente.

**Archivos afectados:** `src/models/Usuario.js`, `src/models/index.js`, `src/middlewares/auth.middleware.js`, `src/controllers/auth.controller.js`, nuevo modelo `Rol.js`.

---

### 3. Subida de documentos con papelera de 30 días

**Requerimiento:** "Los usuarios podrán subir de forma digital sus documentos esenciales (DNI, CUD, CV)." "Cuando un usuario borra un documento, se guarda en un área oculta por 30 días."

**Código actual:** `src/routes/documentos.routes.js` es un stub:
```js
router.get('/', (req, res) => res.json({ mensaje: 'Documentos — próximamente' }));
```

El modelo `Documento` ya tiene campo `deletedAt`, pero sin lógica asociada.

**Acción:**

1. Implementar subida con `multer` a directorio cifrado fuera del `public/`.
2. Validación MIME real (leer magic bytes, no confiar en extensión).
3. Endpoints: `POST /api/documentos/subir`, `GET /api/documentos`, `DELETE /api/documentos/:id` (soft-delete con `deletedAt`).
4. Tarea programada (node-cron) que elimine físicamente documentos con `deletedAt > 30 días`.

**Archivos a crear/modificar:** `src/routes/documentos.routes.js`, `src/controllers/documentos.controller.js`, `src/middlewares/upload.middleware.js`, `src/services/archivos.service.js`.

---

### 4. Búsqueda avanzada con lógica AND/OR

**Requerimiento:** "El gestor puede filtrar la base de datos por múltiples criterios. Se puede activar la opción de que el resultado deba cumplir obligatoriamente con todos los filtros (Y) o con al menos uno (O)."

**Código actual:** No existe.

**Acción:**

1. Endpoint `GET /api/gestor/candidatos/buscar` que acepte:
   - `filtros[]` (array de `{campo, valor, operador}`)
   - `modo` (`AND | OR`)
   - `pagina`, `limite`
2. Construir cláusula WHERE dinámica en Sequelize según el modo.

**Archivos a crear:** `src/controllers/gestor.controller.js`, `src/routes/gestor.routes.js`.

---

### 5. Exportación a Excel

**Requerimiento:** "Los resultados de una búsqueda se pueden descargar en un archivo Excel con enlaces directos a documentos."

**Acción:**

1. Endpoint `GET /api/gestor/candidatos/exportar` con mismos filtros que búsqueda.
2. Generar Excel con `exceljs`.
3. Incluir columnas con enlaces firmados (tokens de acceso temporales) a documentos.

**Dependencia a agregar:** `exceljs`.

---

### 6. Notificaciones in-app con polling

**Requerimiento:** "Cada 10 minutos el sistema verifica si hay novedades. Un indicador sonoro y visual avisa al usuario."

**Código actual:** `src/routes/notificaciones.routes.js` es un stub.

**Acción:**

1. Endpoints CRUD: `GET /api/notificaciones`, `POST /api/notificaciones` (gestor crea), `PUT /api/notificaciones/:id/leer`.
2. Endpoint ligero `GET /api/notificaciones/nuevas?desde={timestamp}` que devuelva solo conteo + IDs.
3. El modelo `Notificacion` ya existe y cubre el requerimiento base.

**Archivos a modificar:** `src/routes/notificaciones.routes.js`, crear `src/controllers/notificaciones.controller.js`.

---

### 7. Preferencias de accesibilidad (modo oscuro y tamaño de fuente)

**Requerimiento:** "Cada persona puede elegir si prefiere modo oscuro o claro, y aumentar el tamaño de la letra. El sistema recuerda estas opciones."

**Código actual:** No existe modelo ni endpoint.

**Acción:**

1. Crear modelo `PreferenciaUsuario` con campos: `modoOscuro: BOOLEAN`, `tamanoFuente: ENUM('normal', 'grande', 'muy-grande')`.
2. Endpoints: `GET /api/preferencias`, `PUT /api/preferencias`.
3. Relación 1:1 con `Usuario`.

**Archivos a crear:** `src/models/PreferenciaUsuario.js`, `src/controllers/preferencias.controller.js`, `src/routes/preferencias.routes.js`.

---

## 🟡 Alta prioridad — Integridad y cumplimiento

### 8. Registro de auditoría para documentos

**Requerimiento:** "El sistema anota automáticamente quién vio cada documento, qué documento fue y en qué momento exacto."

**Acción:**

1. Crear modelo `LogAuditoria` con: `usuarioId`, `accion` (VISUALIZO_DOCUMENTO, DESCARGO_DOCUMENTO, etc.), `detalle` (JSON con metadata), `ip`, `userAgent`, `timestamp`.
2. Middleware o helper que registre cada acceso a un documento.

---

### 9. Validación MIME real en subida

**Requerimiento:** "Implementar una validación de tipo MIME real para las subidas."

**Acción:**

1. Usar `file-type` (Node.js) para leer magic bytes del archivo.
2. Rechazar archivos cuyo MIME real no coincida con la extensión declarada.
3. Bloquear ejecutables, scripts y SVG (pueden contener JS).

---

### 10. Catálogos dinámicos (CRUD + habilitar/deshabilitar)

**Requerimiento:** "Países, provincias, tipos de discapacidad, habilidades técnicas, niveles educativos. Si una opción ya está siendo usada, no se puede eliminar, solo deshabilitar."

**Acción:**

1. Modelo genérico `Catalogo` con campos: `nombre`, `tipo` (enum: pais, provincia, discapacidad, habilidad, etc.), `activo: BOOLEAN`.
2. Endpoints CRUD con restricción: si `activo=false` y hay perfiles usándolo, rechazar DELETE.
3. Endpoint para notificación masiva a usuarios afectados por un deshabilitado.

---

### 11. Notas internas con adjuntos y rich text

**Requerimiento:** "Las notas pueden incluir enlaces o archivos adicionales." "Formato de texto enriquecido."

**Código actual:** El modelo `NotaInterna` existe pero solo guarda texto plano, sin adjuntos.

**Acción:**

1. Agregar campo `formato` (`ENUM('texto', 'markdown')`) a `NotaInterna`.
2. Crear tabla `nota_adjunto` (notaId, documentoId).
3. Soporte en el controller para guardar/recuperar adjuntos.
4. Al editar, crear nueva versión en vez de sobrescribir (historial de cambios).

---

### 12. Rol Coordinador con jerarquía sobre Gestor

**Requerimiento:** "El Coordinador es el único que puede asignar nuevos roles. Un Gestor puede operar la base de datos pero no puede elevar el rango de otros usuarios."

**Código actual:** Solo existe `Administrador` como rol superior.

**Acción:**

1. Reemplazar `Administrador` por `Coordinador`.
2. Agregar `GestorTecnico` como rol separado (con permisos de configuración técnica).
3. Middleware de permisos granulares (no solo por rol, sino por permiso específico).

---

### 13. Reseteo de contraseña por parte del gestor

**Requerimiento:** "En caso de olvido, solo el gestor podrá cambiar la contraseña."

**Código actual:** `POST /api/auth/cambiar-password` requiere la contraseña actual — es autoservicio.

**Acción:**

1. Endpoint `POST /api/gestor/usuarios/:id/resetear-password` (solo Coordinador/Gestor).
2. Genera token de un solo uso con expiración (15 min).
3. El usuario recibe el token (por ahora en la respuesta; a futuro por notificación) y puede canjearlo en `POST /api/auth/resetear/:token`.

---

### 14. Observación de Perfil Incompleto

**Requerimiento:** "Si un perfil le falta información crítica, el gestor puede marcar una Observación de Perfil Incompleto. Alerta naranja en el panel."

**Acción:**

1. Agregar campo `observacionPerfil` (TEXT, nullable) y `fechaObservacion` (DATE) en `CandidatoPerfil`.
2. Cuando un gestor marca la observación, el sistema debe recalcular y exponerla en `GET /api/gestor/candidatos` como alerta.

---

## 🟢 Recomendado — Calidad y arquitectura

### 15. Tests automatizados con herramientas modernas

**Problema actual:** Los tests mockean `require.cache` directamente, lo cual es frágil y no escala a 4 fases de desarrollo.

**Acción:**

1. Migrar a **Jest** o **Vitest** como test runner.
2. Usar **supertest** para tests de integración contra endpoints reales.
3. Base de datos de test con SQLite o MySQL separada.
4. Tests mínimos requeridos:
   - Login con email y con DNI.
   - Multi-rol: cambiar vista y acceder a rutas restringidas.
   - Subida de archivos con y sin permiso.
   - Búsqueda con filtros AND/OR.
   - Exportación Excel.
   - CRUD de catálogos con restricción de borrado.
   - Caducidad de papelera de 30 días.

---

### 16. Cifrado a nivel de campo para datos sensibles

**Requerimiento:** "Los datos sensibles deben cifrarse antes de entrar a MySQL."

**Código actual:** Todos los campos de `candidatos_perfil` están en texto plano.

**Acción:**

1. Definir lista de campos PII (número DNI del usuario, fechas específicas, datos de salud/discapacidad).
2. Usar `crypto.createCipheriv` con AES-256-GCM y clave en variable de entorno.
3. Hooks `beforeSave`/`afterFind` en Sequelize para cifrar/descifrar automáticamente.
4. **No cifrar** campos usados en búsquedas (jurisdicción, ciudad, nivel educativo, habilidades) para no perder filtrabilidad.

---

### 17. Separar secciones de perfil en tablas independientes

**Problema actual:** `CandidatoPerfil` tiene 30+ columnas en una sola tabla. El documento propone tablas separadas por sección.

**Acción (diferible a Fase 2):**

1. Refactorizar a:
   - `perfil_datos_personales`
   - `perfil_discapacidad`
   - `perfil_educacion`
   - `perfil_laboral`
2. Cada sección con su propio `updatedAt` para guardado progresivo independiente.
3. Vista SQL o consulta JOIN para reconstruir el perfil completo.

---

### 18. Preparar infraestructura para tareas asíncronas (Bull + Redis)

**Requerimiento:** "El proceso de subir el backup a Google Drive no debe bloquear la web."

**Acción (dejar preparado, implementar cuando se necesite):**

1. Separar lógica de negocio en servicios (`src/services/`) en lugar de controllers.
2. Cuando llegue Bull + Redis, solo crear workers que llamen a los mismos servicios.
3. Usos futuros: backups automáticos, notificaciones masivas, procesamiento de documentos con IA.

---

### 19. Mantener documentación sincronizada

**Problema actual:** `docs/backend-completo.md` tiene 687 líneas pero no refleja endpoints como `/cambiar-password` ni los stubs actuales.

**Acción:**

1. Documentar cada ruta con comentarios JSDoc estructurados.
2. O generar automáticamente desde las rutas con `swagger-jsdoc` + `swagger-ui-express`.
3. Al actualizar un endpoint, actualizar la documentación en el mismo commit.

---

### 20. Diferencia de stack: requerimiento vs. código

**Hecho:** El documento propone Python/Django + Bootstrap/Alpine.js + Nginx/Gunicorn. El código real es Node.js/Express + Sequelize.

**Impacto:** El documento menciona librerías que no aplican (`django-storages`, `google-api-python-client`, `celery`, `django-dbbackup`, `django-environ`). Sus equivalentes en Node.js son:

| Requerimiento | Django | Node.js equivalente |
|--------------|--------|---------------------|
| ORM | Django ORM | Sequelize |
| Archivos cloud | django-storages | multer + @google-cloud/storage |
| Tareas async | Celery + Redis | Bull + Redis |
| Variables de entorno | django-environ | dotenv |
| Backups DB | django-dbbackup | mysqldump + node-cron |
| IA | google-generativeai, openai | openai (mismo package) |
| Servidor | Gunicorn | PM2, cluster |

**Recomendación:** Si el stack Node.js es definitivo, actualizar el documento de requerimientos para reflejar las tecnologías reales y evitar confusión en futuras fases.

---

## Checklist de acción por fase

### Inmediato (antes de seguir desarrollando)

- [ ] Login con DNI o email
- [ ] Multi-rol (tabla puente + cambiar vista)
- [ ] Subida de archivos con validación MIME
- [ ] Papelera de 30 días

### Semana 1-2

- [ ] Preferencias de accesibilidad (modo oscuro + fuente)
- [ ] Catálogos dinámicos CRUD
- [ ] Búsqueda con AND/OR
- [ ] Exportación Excel

### Semana 3-4

- [ ] Notificaciones in-app con polling
- [ ] Auditoría de documentos
- [ ] Notas internas con adjuntos
- [ ] Reseteo de contraseña por gestor

### Mejora continua

- [ ] Tests con Jest + supertest
- [ ] Cifrado de campos sensibles
- [ ] Separar secciones de perfil en tablas
- [ ] Documentación sincronizada (Swagger)
- [ ] Preparar servicios para tareas asíncronas
- [ ] Reflejar stack real en documentación

---

Documento generado: 11 de junio de 2026.
Basado en: `sistema Programa Ágora Argentina.txt` + código en `src/`.
