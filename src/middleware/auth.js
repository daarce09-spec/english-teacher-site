const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'englishteacher_secret_2025';

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }
  const token = auth.split(' ')[1];
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
}

module.exports = { requireAuth, JWT_SECRET };
