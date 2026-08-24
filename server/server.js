const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares Globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
