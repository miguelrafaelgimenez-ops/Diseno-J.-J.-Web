const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/sqlite');
const emailService = require('../services/email');
const paymentService = require('../services/payment');
const { validateCustomerInput, validateQuantity } = require('../validation/order');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || '';
const STORAGE_FILES = path.join(__dirname, '../../storage/digital_files');
const loginAttempts = new Map();
if (!fs.existsSync(STORAGE_FILES)) fs.mkdirSync(STORAGE_FILES, { recursive: true });

// Middleware de Autenticación de Administrador
function requireAdminAuth(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(503).json({ error: 'Autenticación no disponible: falta JWT_SECRET en el entorno.' });
  }
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
// 1. RUTAS PÚBLICAS DE LA TIENDA Y CHECKOUT AUTOMÁTICO
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

// POST /api/orders/create - Iniciar compra y generar sesión de pago online
router.post('/orders/create', async (req, res) => {
  try {
    const {
      customer_name,
      customer_email,
      customer_email_confirm,
      customer_phone,
      customer_country,
      customer_city,
      cart_items
    } = req.body;

    const customerError = validateCustomerInput({ customer_name, customer_email, customer_phone });
    if (customerError) return res.status(400).json({ error: customerError });

    if (customer_email_confirm && customer_email.trim().toLowerCase() !== customer_email_confirm.trim().toLowerCase()) {
      return res.status(400).json({ error: 'La confirmación del correo electrónico no coincide.' });
    }

    let parsedItems = [];
    try {
      parsedItems = typeof cart_items === 'string' ? JSON.parse(cart_items) : cart_items;
    } catch (e) {
      return res.status(400).json({ error: 'Formato de productos del carrito inválido.' });
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ error: 'El carrito de compras está vacío.' });
    }

    // VALIDACIÓN ESTRICTA DE PRECIOS EN EL SERVIDOR (Prevención de manipulación en cliente)
    let validatedItems = [];
    let calculatedTotal = 0;

    for (const item of parsedItems) {
      const realProd = db.getProductById(item.product_id || item.id);
      if (!realProd || realProd.status !== 'ACTIVE') {
        return res.status(400).json({ error: `El producto '${item.name || item.product_name}' ya no está disponible.` });
      }
      const qty = validateQuantity(item.quantity);
      if (!qty) {
        return res.status(400).json({ error: 'La cantidad solicitada no es válida.' });
      }
      const itemTotal = realProd.price_guarani * qty;
      calculatedTotal += itemTotal;

      validatedItems.push({
        product_id: realProd.id,
        product_name: realProd.name,
        price_guarani: realProd.price_guarani,
        quantity: qty
      });
    }

    // Crear el pedido en estado PENDING
    const orderPayload = {
      customer_name: customer_name.trim(),
      customer_email: customer_email.trim().toLowerCase(),
      customer_phone: customer_phone.trim(),
      customer_country: customer_country || 'Paraguay',
      customer_city: customer_city || '',
      payment_gateway: process.env.PAYMENT_GATEWAY || 'ONLINE_GATEWAY',
      total_guarani: calculatedTotal
    };

    const { order, items } = db.createOrder(orderPayload, validatedItems);

    // Generar sesión / URL de pago en la pasarela
    const paymentSession = await paymentService.createPaymentSession(order, items);

    res.json({
      success: true,
      order: {
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        total_guarani: order.total_guarani,
        status: order.status
      },
      payment_url: paymentSession.payment_url,
      transaction_id: paymentSession.transaction_id
    });

  } catch (err) {
    console.error('[CREATE ORDER ERROR]', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Error al generar la orden de pago.', code: err.code || 'ORDER_CREATE_ERROR' });
  }
});

// GET /api/orders/verify/:code - Verificar estado del pedido en tiempo real
router.get('/orders/verify/:code', (req, res) => {
  try {
    const order = db.getOrderById(req.params.code);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

    res.json({
      success: true,
      order: {
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        total_guarani: order.total_guarani,
        status: order.status,
        delivery_status: order.delivery_status,
        created_at: order.created_at,
        paid_at: order.paid_at,
        download_url: (order.status === 'PAID' && order.delivery) ? `/api/download/${order.delivery.download_token}` : null,
        items: order.items.map(i => ({ name: i.product_name, qty: i.quantity, price: i.price_guarani }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar estado del pedido.' });
  }
});

// ==========================================================================
// 2. WEBHOOK DE LA PASARELA DE PAGOS (AUTOMATIZACIÓN & ENTREGA INMEDIATA)
// ==========================================================================

// POST /api/payments/webhook - Notificación automática de pago aprobado
router.post('/payments/webhook', async (req, res) => {
  try {
    if (!paymentService.isConfigured()) {
      return res.status(503).json({ error: 'Webhook no disponible: falta configurar la pasarela oficial.' });
    }

    const payload = req.body;
    const sigHeader = req.headers['x-payment-signature'] || req.headers['x-pagopar-signature'];

    console.log('[WEBHOOK RECIBIDO]', { body: payload, header: sigHeader });

    // 1. Validar autenticidad de la notificación
    const isValid = paymentService.verifyWebhookSignature(payload, sigHeader);
    if (!isValid) {
      console.warn('[WEBHOOK RECHAZADO: FIRMA INVÁLIDA]');
      return res.status(401).json({ error: 'Firma de webhook no válida.' });
    }

    const orderCode = payload.order_code || payload.order_id || payload.custom_id;
    const transactionId = payload.transaction_id || payload.payment_id || `TX-${Date.now()}`;
    const paymentStatus = (payload.status || payload.event || '').toUpperCase();

    if (!orderCode) {
      return res.status(400).json({ error: 'Falta el identificador del pedido.' });
    }

    const existingOrder = db.getOrderById(orderCode);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Pedido no encontrado en el sistema.' });
    }

    // Si el evento no es de pago aprobado
    if (paymentStatus.includes('FAIL') || paymentStatus.includes('CANCEL')) {
      console.log(`[PAGO FALLIDO/CANCELADO] Pedido ${orderCode}`);
      return res.json({ success: true, message: 'Notificación procesada.' });
    }

    // 2. Procesar pago y entrega con Idempotencia Estricta
    const result = db.markOrderAsPaid(orderCode, transactionId);

    if (result.alreadyProcessed) {
      console.log(`[IDEMPOTENCIA] El pedido ${orderCode} ya fue procesado previamente.`);
      return res.json({ success: true, message: 'Pedido ya procesado anteriormente.' });
    }

    // 3. Enviar correo automático de entrega al cliente
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    await emailService.sendPaymentApprovedEmail(
      result.order,
      result.items,
      result.delivery.download_token,
      baseUrl
    );

    console.log(`✅ [VENTA AUTOMATIZADA] Pedido ${orderCode} PAGADO y ENTREGADO con éxito.`);

    res.json({
      success: true,
      message: 'Pago aprobado y entrega generada automáticamente.',
      order_code: orderCode
    });

  } catch (err) {
    console.error('[WEBHOOK ERROR]', err);
    res.status(500).json({ error: 'Error procesando webhook.' });
  }
});

// ==========================================================================
// 3. DESCARGA SEGURA Y PROTEGIDA DE PRODUCTOS DIGITALES
// ==========================================================================

// GET /api/download/:token - Descarga protegida
router.get('/download/:token', (req, res) => {
  try {
    const record = db.getDeliveryByToken(req.params.token);
    if (!record) {
      return res.status(404).send('Enlace de descarga no válido o no encontrado.');
    }

    const { order, items, delivery } = record;

    if (order.status !== 'PAID' && order.status !== 'DELIVERED') {
      return res.status(403).send('El pago de este pedido no ha sido confirmado.');
    }

    if (delivery.expires_at && new Date(delivery.expires_at) <= new Date()) {
      return res.status(410).send('El enlace de descarga ha expirado.');
    }

    if (delivery.download_limit !== null && delivery.download_limit !== undefined && delivery.download_count >= delivery.download_limit) {
      return res.status(403).send('Se alcanzó el límite de descargas de este enlace.');
    }

    // Incrementar contador de descargas
    db.incrementDownloadCount(delivery.id, { ip: req.ip, userAgent: req.get('user-agent') });

    // Buscar si el producto tiene archivo físico
    const downloadItem = items[0];
    const productObj = db.getProductById(downloadItem.product_id);
    let targetFileName = productObj ? productObj.file_name : '';
    const storageRoot = path.resolve(STORAGE_FILES);
    let filePath = targetFileName ? path.resolve(storageRoot, targetFileName) : null;
    if (filePath && (filePath !== storageRoot && !filePath.startsWith(`${storageRoot}${path.sep}`))) {
      return res.status(400).send('Ruta de producto no válida.');
    }

    if (filePath && fs.existsSync(filePath)) {
      return res.download(filePath, targetFileName);
    }

    // Pantalla de confirmación de acceso digital
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Entrega Digital Confirmada | Diseño J. J.</title>
        <link rel="icon" type="image/png" href="/assets/logo.png">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #040714; color: #f1f5f9; text-align: center; padding: 60px 20px; }
          .card { background: #0b142d; border: 1px solid #00d2ff; max-width: 540px; margin: 0 auto; padding: 35px 25px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,210,255,0.25); }
          h1 { color: #00d2ff; font-size: 1.8rem; margin-bottom: 8px; }
          .badge { display: inline-block; background: rgba(37,211,102,0.15); color: #25d366; border: 1px solid #25d366; padding: 4px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem; margin-bottom: 15px; }
          p { color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; }
          .btn { display: inline-block; background: #25d366; color: #fff; padding: 12px 26px; font-weight: bold; border-radius: 30px; text-decoration: none; margin-top: 20px; box-shadow: 0 4px 20px rgba(37,211,102,0.4); }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">PAGO VERIFICADO ONLINE</div>
          <h1>¡Tu Compra está Lista!</h1>
          <p>Pedido: <b style="color:#00d2ff;">${order.order_code}</b></p>
          <p>Producto: <b>${downloadItem.product_name}</b></p>
          <p>Tu acceso y recursos digitales han sido habilitados. Si necesitas asistencia, nuestro equipo está a tu disposición:</p>
          <a href="https://wa.me/message/6LEPZNC677UDD1" class="btn">SOPORTE POR WHATSAPP</a>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error('[DOWNLOAD ERROR]', err);
    res.status(500).send('Error al procesar la entrega digital.');
  }
});

// ==========================================================================
// 4. RUTAS ADMINISTRATIVAS PROTEGIDAS (/api/admin/...)
// ==========================================================================

// POST /api/admin/login - Iniciar sesión de Administrador
router.post('/admin/login', async (req, res) => {
  try {
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const attempt = loginAttempts.get(clientKey) || { count: 0, firstAt: Date.now() };
    if (Date.now() - attempt.firstAt > 15 * 60 * 1000) {
      attempt.count = 0;
      attempt.firstAt = Date.now();
    }
    if (attempt.count >= 5) {
      return res.status(429).json({ error: 'Demasiados intentos. Intente nuevamente más tarde.' });
    }

    const { username, password } = req.body;
    if (!JWT_SECRET || !process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD_HASH) {
      return res.status(503).json({ error: 'Administración no disponible: faltan secretos obligatorios en el entorno.' });
    }

    const envUser = process.env.ADMIN_USER;
    const isValid = username === envUser && await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);

    if (!isValid) {
      attempt.count += 1;
      loginAttempts.set(clientKey, attempt);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    loginAttempts.delete(clientKey);

    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: { username, role: 'admin' }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en autenticación administrativa.' });
  }
});

// GET /api/admin/dashboard - Métricas automáticas y lista de ventas
router.get('/admin/dashboard', requireAdminAuth, (req, res) => {
  try {
    const metrics = db.getDashboardMetrics();
    const filter = req.query.status || 'ALL';
    const orders = db.getOrders(filter);

    res.json({
      success: true,
      metrics,
      orders
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar panel administrativo.' });
  }
});

// POST /api/admin/orders/:id/resend - Reenviar correo de entrega al cliente
router.post('/admin/orders/:id/resend', requireAdminAuth, async (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

    if (order.status !== 'PAID' && order.status !== 'DELIVERED') {
      return res.status(400).json({ error: 'Solo se pueden reenviar pedidos con pago confirmado.' });
    }

    const delivery = order.delivery || db.createDeliveryToken(order.id);
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    const sent = await emailService.sendPaymentApprovedEmail(
      order,
      order.items,
      delivery.download_token,
      baseUrl
    );

    res.json({
      success: true,
      message: `Correo reenviado exitosamente a ${order.customer_email}.`,
      sent
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al reenviar el correo.' });
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
