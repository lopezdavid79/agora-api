"""
migrate_csv_to_agora.py
=======================
Importa los datos de 'Formá parte de nuestra base de datos (respuestas).csv'
a la base de datos MySQL de Ágora Argentina.

Requisitos:
    pip install pandas mysql-connector-python bcrypt

Uso:
    python migrate_csv_to_agora.py
"""

import csv
import re
import bcrypt
import pandas as pd
import mysql.connector
from datetime import datetime

# ── CONFIGURACIÓN ──────────────────────────────────────────────────────────────
DB_CONFIG = {
    "host":     "localhost",
    "port":     3306,
    "user":     "root",           # ← cambiá según tu entorno
    "password": "",    # ← cambiá según tu entorno
    "database": "agora_argentina",
    "charset":  "utf8mb4",
}

CSV_PATH = "base_de_datos.csv"

# Contraseña temporal para todos los candidatos importados.
# El usuario deberá cambiarla en su primer login.
PASSWORD_TEMPORAL = "AgoraArgentina2026!"
# ───────────────────────────────────────────────────────────────────────────────


def clean(value):
    """Devuelve None si el valor es NaN/vacío, o el string limpio."""
    if pd.isna(value) or str(value).strip() == "":
        return None
    return str(value).strip()


def parse_date(value):
    """Convierte 'DD/MM/YYYY' a 'YYYY-MM-DD'. Devuelve None si falla."""
    raw = clean(value)
    if not raw:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    print(f"  ⚠ Fecha no reconocida: '{raw}' → se omite")
    return None


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def split_drive_links(raw: str) -> list[str]:
    """Separa links de Drive que vienen en una sola celda (separados por coma)."""
    if not raw:
        return []
    return [lnk.strip() for lnk in raw.split(",") if lnk.strip().startswith("http")]


def guess_doc_type(url: str) -> str:
    """Intenta inferir el tipo de documento por el orden en la lista."""
    return "Otro"   # sin metadatos no podemos distinguir; queda para revisión manual


def main():
    print("═" * 60)
    print("  Migración CSV → Ágora Argentina")
    print("═" * 60)

    df = pd.read_csv(CSV_PATH, dtype=str)
    df = df.where(pd.notna(df), None)   # NaN → None

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    insertados = 0
    omitidos   = 0
    errores    = []

    for idx, row in df.iterrows():
        fila_num = idx + 2   # +2: fila 1 = header, base 1

        dni   = clean(row.get("Número de DNI"))
        email = clean(row.get("Dirección de correo electrónico"))
        nombre    = clean(row.get("Nombre"))
        apellido  = clean(row.get("Apellido"))

        if not dni or not email:
            msg = f"Fila {fila_num}: DNI o email vacío ({nombre} {apellido}) → omitida"
            print(f"  ⚠ {msg}")
            errores.append(msg)
            omitidos += 1
            continue

        # Normalizar DNI (solo dígitos)
        dni_clean = re.sub(r"\D", "", dni)

        try:
            # ── 1. USUARIO ───────────────────────────────────────────────
            password_hash = hash_password(PASSWORD_TEMPORAL)

            cursor.execute("""
                INSERT INTO usuarios (dni, email, password, rol)
                VALUES (%s, %s, %s, 'Candidato')
                ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
            """, (dni_clean, email.lower(), password_hash))

            usuario_id = cursor.lastrowid

            # Si lastrowid = 0 el registro ya existía; obtener el id real
            if usuario_id == 0:
                cursor.execute("SELECT id FROM usuarios WHERE dni = %s", (dni_clean,))
                usuario_id = cursor.fetchone()[0]
                print(f"  → Fila {fila_num}: usuario ya existe (dni={dni_clean}), actualizando perfil")

            # ── 2. PERFIL ────────────────────────────────────────────────
            cursor.execute("""
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
                    informacion_adicional,
                    estado_perfil
                )
                VALUES (
                    %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s,
                    'Pendiente'
                )
                ON DUPLICATE KEY UPDATE
                    nombre                  = VALUES(nombre),
                    apellido                = VALUES(apellido),
                    celular                 = VALUES(celular),
                    fecha_nacimiento        = VALUES(fecha_nacimiento),
                    genero                  = VALUES(genero),
                    pais_residencia         = VALUES(pais_residencia),
                    nacionalidad            = VALUES(nacionalidad),
                    jurisdiccion            = VALUES(jurisdiccion),
                    ciudad                  = VALUES(ciudad),
                    discapacidad_visual     = VALUES(discapacidad_visual),
                    condicion_visual        = VALUES(condicion_visual),
                    otra_discapacidad       = VALUES(otra_discapacidad),
                    descripcion_otra_disc   = VALUES(descripcion_otra_disc),
                    tiene_cud               = VALUES(tiene_cud),
                    beneficio_social        = VALUES(beneficio_social),
                    tipo_escolaridad        = VALUES(tipo_escolaridad),
                    nivel_educativo         = VALUES(nivel_educativo),
                    carrera_estudios        = VALUES(carrera_estudios),
                    braille                 = VALUES(braille),
                    autonomia               = VALUES(autonomia),
                    apoyos_desplazamiento   = VALUES(apoyos_desplazamiento),
                    vinculo_tecnologia      = VALUES(vinculo_tecnologia),
                    herramientas_tecnologicas = VALUES(herramientas_tecnologicas),
                    idiomas                 = VALUES(idiomas),
                    emprendimiento          = VALUES(emprendimiento),
                    busqueda_formacion      = VALUES(busqueda_formacion),
                    tipo_formacion_buscada  = VALUES(tipo_formacion_buscada),
                    busqueda_empleo         = VALUES(busqueda_empleo),
                    tiene_trabajo_actual    = VALUES(tiene_trabajo_actual),
                    area_trabajo_actual     = VALUES(area_trabajo_actual),
                    informacion_adicional   = VALUES(informacion_adicional)
            """, (
                usuario_id,
                nombre,
                apellido,
                clean(row.get("Celular")),
                parse_date(row.get("Fecha de nacimiento")),
                clean(row.get("Género")),
                clean(row.get("País de Residencia (Te recordamos que tienen prioridad usuarios de Argentina)")),
                clean(row.get("Nacionalidad")),
                clean(row.get("Jurisdicción")),
                clean(row.get("Ciudad de residencia")),
                clean(row.get("¿Sos una persona con discapacidad visual?")),
                clean(row.get("Tu condición es...")),
                clean(row.get("¿Tenes, además, alguna otra discapacidad o condición que sea necesario informar?")),
                clean(row.get("¿Cuál? En caso de que la respuesta anterior sea afirmativa.")),
                clean(row.get("¿Tenes CUD?")),
                clean(row.get("¿Percibís algún tipo de beneficio?")),
                clean(row.get("¿A qué tipo de escolaridad asististe?")),
                clean(row.get("Nivel Educativo")),
                clean(row.get("¿Qué carrera estudias o estudiaste?")),
                clean(row.get("¿Sos usuario del sistema Braille?")),
                clean(row.get("En relación a tu autonomía...")),
                clean(row.get("En relación a los apoyos para el desplazamiento...")),
                clean(row.get("En relación al vínculo con la tecnología...")),
                clean(row.get("¿Qué herramientas utilizas?")),
                clean(row.get("Idiomas (Indicar idioma y nivel > básico, medio, avanzado)")),
                clean(row.get("¿Tenes algún emprendimiento? Contanos de qué trata y dejanos las redes ")),
                clean(row.get("¿Estás buscando formarte?")),
                clean(row.get("¿Qué tipo de formación estas buscando?")),
                clean(row.get("¿Estás buscando empleo?")),
                clean(row.get("¿Tenés trabajo actualmente?")),
                clean(row.get("¿En qué área?")),
                clean(row.get("¿Hay algo más sobre vos que quieras contarnos?")),
            ))

            # Obtener perfil_id
            cursor.execute("SELECT id FROM candidatos_perfil WHERE usuario_id = %s", (usuario_id,))
            perfil_id = cursor.fetchone()[0]

            # ── 3. DOCUMENTOS (links de Drive) ───────────────────────────
            raw_docs = clean(row.get("Por favor, subí en este espacio tu CV, DNI y CUD para poder ingresarte a la base de datos"))
            links = split_drive_links(raw_docs) if raw_docs else []

            # Tipos esperados según orden del formulario: CV, DNI, CUD, resto=Otro
            tipo_map = {0: "CV", 1: "DNI", 2: "CUD"}

            for i, link in enumerate(links):
                tipo = tipo_map.get(i, "Otro")
                cursor.execute("""
                    INSERT INTO documentos (perfil_id, tipo_documento, url_drive)
                    VALUES (%s, %s, %s)
                """, (perfil_id, tipo, link))

            conn.commit()
            insertados += 1
            print(f"  ✓ Fila {fila_num}: {nombre} {apellido} — {len(links)} doc(s)")

        except mysql.connector.Error as e:
            conn.rollback()
            msg = f"Fila {fila_num}: ERROR MySQL {e.errno} — {e.msg}"
            print(f"  ✗ {msg}")
            errores.append(msg)
            omitidos += 1

    cursor.close()
    conn.close()

    print()
    print("═" * 60)
    print(f"  Resultado: {insertados} importados | {omitidos} omitidos")
    if errores:
        print("\n  Errores / advertencias:")
        for e in errores:
            print(f"    · {e}")
    print("═" * 60)


if __name__ == "__main__":
    main()
