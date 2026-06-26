const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const {
  Usuario,
  CandidatoPerfil,
  Documento,
  Notificacion,
  Rol,
  UsuarioRol,
} = require('../models/index');

// ── GET /api/gestor/usuarios ──────────────────────────────────
async function listarUsuarios(req, res) {
  try {
    const { search, rol } = req.query;
    let { activo } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const where = {};

    if (search) {
      const escaped = String(search).replace(/[%_]/g, '\\$&');
      where[Op.or] = [
        { email: { [Op.like]: `%${escaped}%` } },
        { dni: { [Op.like]: `%${escaped}%` } },
        { '$perfil.nombre$': { [Op.like]: `%${escaped}%` } },
        { '$perfil.apellido$': { [Op.like]: `%${escaped}%` } },
      ];
    }

    if (rol) {
      where.rol = rol;
    }

    if (activo !== undefined && activo !== '') {
      where.activo = activo === 'true' || activo === true;
    }

    const { count, rows } = await Usuario.findAndCountAll({
      attributes: { exclude: ['password'] },
      where,
      include: [
        {
          model: CandidatoPerfil,
          as: 'perfil',
          attributes: ['id', 'nombre', 'apellido', 'estadoPerfil', 'porcentajeCompletitud'],
        },
      ],
      offset,
      limit,
      distinct: true,
      subQuery: false,
      order: [['fecha_registro', 'DESC']],
    });

    return res.json({
      usuarios: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error('Error al listar usuarios:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── GET /api/gestor/usuarios/:id ──────────────────────────────
async function obtenerUsuario(req, res) {
  try {
    const { id } = req.params;

    const usuario = await Usuario.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: CandidatoPerfil,
          as: 'perfil',
          include: [
            {
              model: Documento,
              as: 'documentos',
              where: { deletedAt: null },
              required: false,
            },
          ],
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Últimas 5 notificaciones
    const notificaciones = await Notificacion.findAll({
      where: { usuarioId: id },
      order: [['fecha_envio', 'DESC']],
      limit: 5,
    });

    const resultado = usuario.get({ plain: true });
    resultado.notificaciones = notificaciones;

    return res.json(resultado);
  } catch (err) {
    console.error('Error al obtener usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/gestor/usuarios/:id/suspender ────────────────────
async function suspenderUsuario(req, res) {
  try {
    const { id } = req.params;

    // No permitir suspenderse a uno mismo
    if (parseInt(id, 10) === req.usuario.id) {
      return res.status(400).json({ error: 'No podés suspender tu propia cuenta' });
    }

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!usuario.activo) {
      return res.status(400).json({ error: 'La cuenta ya está suspendida' });
    }

    await usuario.update({ activo: false });

    const usuarioResponse = usuario.get({ plain: true });
    delete usuarioResponse.password;

    return res.json({
      mensaje: 'Cuenta suspendida correctamente',
      usuario: usuarioResponse,
    });
  } catch (err) {
    console.error('Error al suspender usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/gestor/usuarios/:id/reactivar ────────────────────
async function reactivarUsuario(req, res) {
  try {
    const { id } = req.params;

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (usuario.activo) {
      return res.status(400).json({ error: 'La cuenta ya está activa' });
    }

    await usuario.update({ activo: true });

    const usuarioResponse = usuario.get({ plain: true });
    delete usuarioResponse.password;

    return res.json({
      mensaje: 'Cuenta reactivada correctamente',
      usuario: usuarioResponse,
    });
  } catch (err) {
    console.error('Error al reactivar usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/gestor/usuarios/:id/rol ──────────────────────────
async function cambiarRol(req, res) {
  try {
    const { id } = req.params;
    const { rol } = req.body;

    const ROLES_PERMITIDOS = ['Candidato', 'Gestor', 'Coordinador', 'GestorTecnico', 'Administrador'];
    if (!ROLES_PERMITIDOS.includes(rol)) {
      return res.status(400).json({
        error: `Rol inválido. Debe ser uno de: ${ROLES_PERMITIDOS.join(', ')}`,
      });
    }

    if (parseInt(id, 10) === req.usuario.id) {
      return res.status(400).json({ error: 'No podés cambiar tu propio rol' });
    }

    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Buscar el rol en la tabla roles
    const [rolRecord] = await Rol.findOrCreate({ where: { nombre: rol } });

    // Verificar si ya tiene esa asignación
    const existe = await UsuarioRol.findOne({
      where: { usuarioId: id, rolId: rolRecord.id },
    });

    if (existe) {
      // Activar este rol, desactivar otros
      await UsuarioRol.update({ activo: false }, { where: { usuarioId: id } });
      await existe.update({ activo: true });
    } else {
      // Nueva asignación
      await UsuarioRol.update({ activo: false }, { where: { usuarioId: id } });
      await UsuarioRol.create({ usuarioId: id, rolId: rolRecord.id, activo: true });
    }

    // Actualizar también la columna rol en usuarios para compatibilidad
    await usuario.update({ rol });

    const usuarioResponse = usuario.get({ plain: true });
    delete usuarioResponse.password;

    return res.json({
      mensaje: 'Rol actualizado correctamente',
      usuario: usuarioResponse,
    });
  } catch (err) {
    console.error('Error al cambiar rol:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── POST /api/gestor/usuarios ──────────────────────────────────
async function crearUsuario(req, res) {
  try {
    const { dni, email, password, nombre, apellido } = req.body;

    if (!dni || !email || !password) {
      return res.status(400).json({ error: 'dni, email y password son requeridos' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const existe = await Usuario.findOne({ where: { [Op.or]: [{ dni }, { email }] } });
    if (existe) {
      const campo = existe.dni === dni ? 'DNI' : 'email';
      return res.status(409).json({ error: `El ${campo} ya está registrado` });
    }

    const hash = await bcrypt.hash(password, 10);

    const usuario = await Usuario.create({
      dni,
      email,
      password: hash,
      rol: 'Gestor',
    });

    // Si se enviaron nombre/apellido, crear el perfil asociado
    if (nombre || apellido) {
      await CandidatoPerfil.create({
        usuarioId: usuario.id,
        nombre: nombre || '',
        apellido: apellido || '',
      });
    }

    const usuarioResponse = usuario.get({ plain: true });
    delete usuarioResponse.password;

    return res.status(201).json({
      mensaje: 'Usuario gestor creado correctamente',
      usuario: usuarioResponse,
    });
  } catch (err) {
    console.error('Error al crear usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── PUT /api/gestor/usuarios/:id ───────────────────────────────
async function editarUsuario(req, res) {
  try {
    const { id } = req.params;
    const { dni, email, password, nombre, apellido } = req.body;

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const updates = {};
    if (dni !== undefined) updates.dni = dni;
    if (email !== undefined) updates.email = email;
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }
      updates.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updates).length > 0) {
      await usuario.update(updates);
    }

    // Actualizar nombre/apellido en el perfil si existe
    if (nombre !== undefined || apellido !== undefined) {
      const [perfil] = await CandidatoPerfil.findOrCreate({
        where: { usuarioId: id },
        defaults: { usuarioId: id, nombre: '', apellido: '' },
      });
      const perfilUpdates = {};
      if (nombre !== undefined) perfilUpdates.nombre = nombre;
      if (apellido !== undefined) perfilUpdates.apellido = apellido;
      if (Object.keys(perfilUpdates).length > 0) {
        await perfil.update(perfilUpdates);
      }
    }

    const usuarioResponse = usuario.get({ plain: true });
    delete usuarioResponse.password;

    return res.json({
      mensaje: 'Usuario actualizado correctamente',
      usuario: usuarioResponse,
    });
  } catch (err) {
    console.error('Error al editar usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── DELETE /api/gestor/usuarios/:id ────────────────────────────
async function eliminarUsuario(req, res) {
  try {
    const { id } = req.params;

    if (parseInt(id, 10) === req.usuario.id) {
      return res.status(400).json({ error: 'No podés eliminar tu propia cuenta' });
    }

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Eliminar dependencias asociadas
    await Notificacion.destroy({ where: { usuarioId: id } });
    await CandidatoPerfil.destroy({ where: { usuarioId: id } });
    await usuario.destroy();

    return res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  suspenderUsuario,
  reactivarUsuario,
  cambiarRol,
};
