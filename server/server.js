const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS explícito: en desarrollo se permite el origen del propio servidor;
// en producción debe declararse CORS_ORIGIN sin usar un comodín.
const allowedOrigins = (process.env.CORS_ORIGIN || `http://localhost:${PORT}`).split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origen no permitido por CORS.'));
} }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Rutas de API
app.use('/api', apiRoutes);

// Servir archivos estáticos del sitio web (HTML, CSS, JS, Assets, Imagen)
const rootDir = path.join(__dirname, '..');
app.use(express.static(rootDir));

// Manejo de ruta raíz por defecto
app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Iniciar Servidor HTTP
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 SERVIDOR DE VENTAS DIGITALES — DISEÑO J. J.`);
  console.log(`🌐 Sitio Web: http://localhost:${PORT}`);
  console.log(`🛒 Tienda Digital: http://localhost:${PORT}/tienda.html`);
  console.log(`🔒 Panel Admin: http://localhost:${PORT}/admin/index.html`);
  console.log('====================================================');
});
