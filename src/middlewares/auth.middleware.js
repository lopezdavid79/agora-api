const jwt = require('jsonwebtoken');

/**
 * Verifica el JWT en la cookie agora_at (primero) o en el header
 * Authorization: Bearer <token> (fallback para compatibilidad).
 *
 * Variables de entorno:
 *   DISABLE_HEADER_AUTH=true — desactiva el fallback a Authorization header,
 *   útil una vez que todos los clientes migraron a cookies.
 */
function verificarToken(req, res, next) {
  let token = req.cookies?.agora_at;

  if (!token && !process.env.DISABLE_HEADER_AUTH) {
    token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;   // { id, rol, email, roles }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware de autorización por rol.
 * Uso: soloRoles('Gestor', 'Administrador')
 */
function soloRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      return res.status(403).json({ error: 'No tenés permiso para esta acción' });
    }
    next();
  };
}

module.exports = { verificarToken, soloRoles };
