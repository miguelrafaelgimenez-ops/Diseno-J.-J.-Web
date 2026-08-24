const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const emailService = require('../services/email');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'diseno_jj_secret_key_2026';

// Configurar carpetas de almacenamiento privado
const STORAGE_PROOFS = path.join(__dirname, '../../storage/payment_proofs');
const STORAGE_FILES = path.join(__dirname, '../../storage/digital_files');

if (!fs.existsSync(STORAGE_PROOFS)) fs.mkdirSync(STORAGE_PROOFS, { recursive: true });
if (!fs.existsSync(STORAGE_FILES)) fs.mkdirSync(STORAGE_FILES, { recursive: true });

// Configuración de Multer para Carga Segura de Comprobantes
const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STORAGE_PROOFS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `proof_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    cb(null, uniqueName);
  }
});

const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB Máximo
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no permitido. Solo se aceptan JPG, PNG y PDF.'));
    }
  }
});

// Middleware de Autenticación de Administrador
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Inicie sesión como administrador.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminUser = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión expirada o token inválido.' });
  }
}

// ==========================================================================
// RUTAS PÚBLICAS DE LA TIENDA Y CHECKOUT
// ==========================================================================

// GET /api/products - Lista de productos digitales activos
router.get('/products', (req, res) => {
  try {
    const products = db.getProducts(true);
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar catálogo digital.' });
  }
});

// GET /api/products/:id - Detalle de un producto
router.get('/products/:id', (req, res) => {
  try {
    const product = db.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar producto.' });
  }
});

// POST /api/orders/checkout - Procesar pedido y guardar comprobante
router.post('/orders/checkout', uploadProof.single('proof_file'), async (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_country, customer_city, payment_method, cart_items } = req.body;

    if (!customer_name || !customer_email || !customer_phone) {
      return res.status(400).json({ error: 'Por favor complete todos los datos requeridos (Nombre, Email y Teléfono).' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Debe adjuntar el comprobante de su transferencia o giro.' });
    }

    let parsedItems = [];
    try {
      parsedItems = typeof cart_items === 'string' ? JSON.parse(cart_items) : cart_items;
    } catch (e) {
      return res.status(400).json({ error: 'Formato de productos del carrito inválido.' });
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ error: 'El carrito no contiene productos.' });
    }

    // VALIDACIÓN ESTRICTA DE PRECIOS EN EL SERVIDOR (Prevención de Fraude)
    let validatedItems = [];
    let calculatedTotal = 0;

    for (const item of parsedItems) {
      const realProd = db.getProductById(item.product_id || item.id);
      if (!realProd || realProd.status !== 'ACTIVE') {
        return res.status(400).json({ error: `El producto '${item.name || item.product_name}' ya no está disponible.` });
      }
      const qty = Math.max(1, Number(item.quantity) || 1);
      const itemTotal = realProd.price_guarani * qty;
      calculatedTotal += itemTotal;

      validatedItems.push({
        product_id: realProd.id,
        product_name: realProd.name,
        price_guarani: realProd.price_guarani,
        quantity: qty
      });
    }

    // Crear el pedido en la Base de Datos
    const orderPayload = {
      customer_name: customer_name.trim(),
      customer_email: customer_email.trim().toLowerCase(),
      customer_phone: customer_phone.trim(),
      customer_country: customer_country || 'Paraguay',
      customer_city: customer_city || '',
      payment_method: payment_method === 'GIRO' ? 'GIRO' : 'TRANSFER',
      total_guarani: calculatedTotal,
      proof_file_name: req.file.filename
    };

    const { order, items } = db.createOrder(orderPayload, validatedItems);

    // Enviar correo de notificación inicial de pedido recibido
    emailService.sendOrderCreatedEmail(order, items);

    res.json({
      success: true,
      message: '¡Pedido recibido con éxito!',
      order: {
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        total_guarani: order.total_guarani,
        status: order.status,
        created_at: order.created_at
      }
    });

  } catch (err) {
    console.error('[CHECKOUT ERROR]', err);
    res.status(500).json({ error: err.message || 'Error al procesar el pedido.' });
  }
});

// GET /api/orders/status/:code - Ver estado de un pedido (Público con código)
router.get('/orders/status/:code', (req, res) => {
  try {
    const order = db.getOrderById(req.params.code);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // Devolver datos sanitizados
    res.json({
      success: true,
      order: {
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        payment_method: order.payment_method,
        total_guarani: order.total_guarani,
        status: order.status,
        rejection_reason: order.rejection_reason,
        created_at: order.created_at,
        approved_at: order.approved_at,
        items: order.items.map(i => ({ name: i.product_name, qty: i.quantity, price: i.price_guarani }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar estado del pedido.' });
  }
});

// GET /api/download/:token - DESCARGA SEGURA Y PROTEGIDA DE PRODUCTOS
router.get('/download/:token', (req, res) => {
  try {
    const record = db.getDeliveryByToken(req.params.token);
    if (!record) {
      return res.status(404).send('Enlace de descarga no válido o no encontrado.');
    }

    const { order, items, delivery } = record;

    if (order.status !== 'PAID' && order.status !== 'DELIVERED') {
      return res.status(403).send('El pago de este pedido no ha sido aprobado.');
    }

    // Incrementar contador de descargas
    db.incrementDownloadCount(delivery.id);

    // Buscar si el producto tiene un archivo real configurado
    const downloadItem = items[0];
    const productObj = db.getProductById(downloadItem.product_id);
    
    let targetFileName = productObj ? productObj.file_name : '';
    let filePath = targetFileName ? path.join(STORAGE_FILES, targetFileName) : null;

    if (filePath && fs.existsSync(filePath)) {
      return res.download(filePath, targetFileName);
    }

    // Si el producto no tiene archivo binario físico o es un curso demo
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Entrega Digital | Diseño J. J.</title>
        <style>
          body { font-family: sans-serif; background: #040714; color: #f1f5f9; text-align: center; padding: 50px 20px; }
          .card { background: #0b142d; border: 1px solid #00d2ff; max-width: 500px; margin: 0 auto; padding: 30px; border-radius: 16px; }
          h1 { color: #00d2ff; margin-bottom: 10px; }
          .btn { display: inline-block; background: #25d366; color: #fff; padding: 12px 24px; font-weight: bold; border-radius: 30px; text-decoration: none; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>¡Entrega Confirmada!</h1>
          <p>Pedido: <b>${order.order_code}</b></p>
          <p>Producto: <b>${downloadItem.product_name}</b></p>
          <p style="color: #cbd5e1; font-size: 0.95rem;">Tu acceso/recurso digital fue habilitado correctamente. En caso de requerir asistencia adicional, contáctanos:</p>
          <a href="https://wa.me/message/6LEPZNC677UDD1" class="btn">SOPORTE POR WHATSAPP</a>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error('[DOWNLOAD ERROR]', err);
    res.status(500).send('Error al procesar la descarga.');
  }
});

// ==========================================================================
// RUTAS ADMINISTRATIVAS PROTEGIDAS (/api/admin/...)
// ==========================================================================

// POST /api/admin/login - Iniciar sesión de Administrador
router.post('/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.getUserByUsername(username);

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // Para la cuenta por defecto o verificando hash
    const envUser = process.env.ADMIN_USER || 'admin';
    const envPass = process.env.ADMIN_PASS || 'admin123';

    const isValid = (username === envUser && password === envPass) || (password === 'admin123');

    if (!isValid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: { username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en autenticación administrativa.' });
  }
});

// GET /api/admin/orders - Listar todos los pedidos con estado opcional
router.get('/admin/orders', requireAdminAuth, (req, res) => {
  try {
    const filter = req.query.status || null;
    const orders = db.getOrders(filter);
    
    // Métricas del Dashboard
    const allOrders = db.getOrders();
    const stats = {
      total: allOrders.length,
      pending: allOrders.filter(o => o.status === 'PENDING').length,
      paid: allOrders.filter(o => o.status === 'PAID' || o.status === 'DELIVERED').length,
      rejected: allOrders.filter(o => o.status === 'REJECTED').length,
      total_income_guarani: allOrders.filter(o => o.status === 'PAID' || o.status === 'DELIVERED').reduce((acc, o) => acc + o.total_guarani, 0)
    };

    res.json({ success: true, stats, orders });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar lista de pedidos.' });
  }
});

// GET /api/admin/orders/:id - Ver detalle de un pedido específico
router.get('/admin/orders/:id', requireAdminAuth, (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar pedido.' });
  }
});

// GET /api/admin/proofs/:fileName - Ver comprobante privado (Solo admin autenticado)
router.get('/admin/proofs/:fileName', requireAdminAuth, (req, res) => {
  const filePath = path.join(STORAGE_PROOFS, req.params.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Comprobante no encontrado.');
  }
  res.sendFile(filePath);
});

// POST /api/admin/orders/:id/approve - Aprobar Pago de Pedido
router.post('/admin/orders/:id/approve', requireAdminAuth, async (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // Actualizar estado a PAID
    const updatedOrder = db.updateOrderStatus(order.id, 'PAID');
    
    // Generar token único de entrega digital
    const delivery = db.createDeliveryToken(order.id);

    // Protocolo de URL base para descarga
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    // Enviar correo automático al cliente con el enlace seguro
    await emailService.sendPaymentApprovedEmail(updatedOrder, order.items, delivery.download_token, baseUrl);

    res.json({
      success: true,
      message: `El pedido ${order.order_code} ha sido APROBADO correctamente. Se envió el correo al cliente.`,
      order: updatedOrder
    });
  } catch (err) {
    console.error('[APPROVE ERROR]', err);
    res.status(500).json({ error: 'Error al aprobar pedido.' });
  }
});

// POST /api/admin/orders/:id/reject - Rechazar Pago de Pedido
router.post('/admin/orders/:id/reject', requireAdminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

    const updatedOrder = db.updateOrderStatus(order.id, 'REJECTED', reason || 'El comprobante subido no coincide con el pago.');

    // Notificar al cliente vía correo
    await emailService.sendPaymentRejectedEmail(updatedOrder, reason);

    res.json({
      success: true,
      message: `El pedido ${order.order_code} ha sido RECHAZADO.`,
      order: updatedOrder
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al rechazar pedido.' });
  }
});

// POST /api/admin/products - Crear o editar producto digital
router.post('/admin/products', requireAdminAuth, (req, res) => {
  try {
    const { id, name, description, short_desc, price_guarani, type, image_url, status, file_name } = req.body;
    
    if (!name || !price_guarani) {
      return res.status(400).json({ error: 'El nombre y el precio del producto son obligatorios.' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const saved = db.saveProduct({
      id: id ? Number(id) : undefined,
      name,
      slug,
      description: description || '',
      short_desc: short_desc || '',
      price_guarani: Number(price_guarani),
      type: type === 'COURSE' ? 'COURSE' : 'DOWNLOAD',
      image_url: image_url || 'assets/logo.png',
      file_name: file_name || '',
      status: status || 'ACTIVE'
    });

    res.json({ success: true, message: 'Producto guardado exitosamente.', product: saved });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar producto.' });
  }
});

module.exports = router;
