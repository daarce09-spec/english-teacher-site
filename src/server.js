require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDB } = require('./db/database');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// ── SEGURIDAD ──────────────────────────────
// Headers de seguridad HTTP
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limit general — 100 requests por IP cada 15 min
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Demasiadas solicitudes. Intenta en unos minutos.' }
}));

// Rate limit estricto para login — 10 intentos por IP cada 15 min
app.use('/api/admin/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Demasiados intentos de login. Espera 15 minutos.' }
}));

// CORS solo para el mismo dominio en producción
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '*']
    : '*'
}));

app.use(express.json({ limit: '10kb' })); // Limita el tamaño del body
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔒 Security: helmet + rate limiting enabled`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to initialize DB:', err);
    process.exit(1);
  });
