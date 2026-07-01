-- ============================================================
--  PROGRAMA ÁGORA ARGENTINA — Base de Datos v2.0
--  Generado: 2026-05
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. USUARIOS (login y credenciales)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    dni             VARCHAR(20)  NOT NULL UNIQUE,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,               -- hash bcrypt
    rol             ENUM('Candidato', 'Gestor', 'Administrador') DEFAULT 'Candidato',
    activo          TINYINT(1)   NOT NULL DEFAULT 1,
    fecha_registro  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso   TIMESTAMP    NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. CANDIDATOS — PERFIL (datos del formulario)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidatos_perfil (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id              INT          NOT NULL UNIQUE,

    -- Datos personales
    nombre                  VARCHAR(100),
    apellido                VARCHAR(100),
    celular                 VARCHAR(50),
    fecha_nacimiento        DATE,
    genero                  VARCHAR(50),
    pais_residencia         VARCHAR(100),
    nacionalidad            VARCHAR(100),
    jurisdiccion            VARCHAR(100),               -- Provincia
    ciudad                  VARCHAR(100),

    -- Discapacidad
    discapacidad_visual     VARCHAR(150),
    condicion_visual        VARCHAR(100),               -- Congénita / Adquirida
    otra_discapacidad       VARCHAR(10),                -- Sí / No
    descripcion_otra_disc   TEXT,
    tiene_cud               VARCHAR(10),
    beneficio_social        VARCHAR(150),

    -- Educación
    tipo_escolaridad        VARCHAR(100),
    nivel_educativo         VARCHAR(100),
    carrera_estudios        TEXT,

    -- Autonomía y tecnología
    braille                 VARCHAR(10),
    autonomia               TEXT,
    apoyos_desplazamiento   TEXT,
    vinculo_tecnologia      TEXT,
    herramientas_tecnologicas TEXT,

    -- Idiomas
    idiomas                 TEXT,

    -- Emprendimiento
    emprendimiento          TEXT,

    -- Búsqueda laboral / formación
    busqueda_formacion      VARCHAR(10),
    tipo_formacion_buscada  TEXT,
    busqueda_empleo         VARCHAR(10),
    tiene_trabajo_actual    VARCHAR(10),
    area_trabajo_actual     VARCHAR(150),

    -- Campo libre
    informacion_adicional   TEXT,

    -- Estado del perfil (3 estados según el sistema)
    estado_perfil   ENUM('Pendiente', 'Pre-aprobado', 'Aprobado') DEFAULT 'Pendiente',

    -- Porcentaje de completitud (calculado al guardar)
    porcentaje_completitud  TINYINT UNSIGNED DEFAULT 0,

    fecha_creacion          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_perfil_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. DOCUMENTOS (links de Drive + metadatos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    perfil_id       INT          NOT NULL,
    tipo_documento  ENUM('CV', 'DNI', 'CUD', 'Otro') DEFAULT 'Otro',
    url_drive       TEXT         NOT NULL,
    nombre_archivo  VARCHAR(255),
    fecha_subida    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    -- Papelera de seguridad: NULL = activo; fecha = en papelera
    deleted_at      TIMESTAMP    NULL DEFAULT NULL,

    CONSTRAINT fk_doc_perfil
        FOREIGN KEY (perfil_id) REFERENCES candidatos_perfil(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. AUDITORÍA DE DOCUMENTOS (libro de visitas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria_documentos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    documento_id    INT          NOT NULL,
    usuario_id      INT          NOT NULL,
    accion          ENUM('Vista', 'Descarga', 'Subida', 'Eliminación') NOT NULL,
    ip_origen       VARCHAR(45),                         -- soporta IPv6
    fecha           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_doc
        FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_usuario
        FOREIGN KEY (usuario_id)   REFERENCES usuarios(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. NOTAS INTERNAS (expediente privado — solo gestores)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notas_internas (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    perfil_id       INT          NOT NULL,
    gestor_id       INT          NOT NULL,
    contenido       TEXT         NOT NULL,
    fecha_creacion  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    fecha_edicion   TIMESTAMP    NULL,

    CONSTRAINT fk_nota_perfil
        FOREIGN KEY (perfil_id)  REFERENCES candidatos_perfil(id) ON DELETE CASCADE,
    CONSTRAINT fk_nota_gestor
        FOREIGN KEY (gestor_id)  REFERENCES usuarios(id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6. NOTIFICACIONES (avisos gestor → candidato)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id      INT          NOT NULL,              -- destinatario
    emisor_id       INT          NULL,                  -- NULL = sistema automático
    asunto          VARCHAR(255) NOT NULL,
    mensaje         TEXT         NOT NULL,
    leida           TINYINT(1)   NOT NULL DEFAULT 0,
    fecha_envio     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    fecha_lectura   TIMESTAMP    NULL,

    CONSTRAINT fk_notif_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_emisor
        FOREIGN KEY (emisor_id)  REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 7. PREFERENCIAS DE USUARIO (accesibilidad)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preferencias_usuario (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id      INT          NOT NULL UNIQUE,
    modo_oscuro     TINYINT(1)   NOT NULL DEFAULT 0,
    tamano_fuente   ENUM('normal', 'grande', 'muy_grande') DEFAULT 'normal',
    alto_contraste  TINYINT(1)   NOT NULL DEFAULT 0,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_pref_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- ÍNDICES para búsquedas frecuentes del panel de gestores
-- ------------------------------------------------------------
CREATE INDEX idx_perfil_estado      ON candidatos_perfil (estado_perfil);
CREATE INDEX idx_perfil_jurisdiccion ON candidatos_perfil (jurisdiccion);
CREATE INDEX idx_perfil_ciudad      ON candidatos_perfil (ciudad);
CREATE INDEX idx_perfil_nivel_ed    ON candidatos_perfil (nivel_educativo);
CREATE INDEX idx_doc_perfil_tipo    ON documentos (perfil_id, tipo_documento);
CREATE INDEX idx_doc_deleted        ON documentos (deleted_at);
CREATE INDEX idx_notif_usuario_leida ON notificaciones (usuario_id, leida);

SET FOREIGN_KEY_CHECKS = 1;
