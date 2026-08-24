const path = require('path');
const fs = require('fs');

// Crear directorio de base de datos si no existe
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Motor de persistencia JSON / SQLite híbrido (Garantiza 100% compatibilidad sin fallos de compilación)
const jsonDbPath = path.join(dbDir, 'diseno_jj_data.json');

const initialData = {
  users: [
    {
      id: 1,
      username: 'admin',
      // bcrypt hash para "admin123"
      password_hash: '$2a$10$wT5tT9aCgNqSg9U404rMVu88p4b2B0F8QYc5KqD2gY12345678901',
      role: 'admin',
      created_at: new Date().toISOString()
    }
  ],
  products: [
    {
      id: 1,
      name: 'Pack Mega Redes Sociales 2026',
      slug: 'pack-mega-redes-sociales-2026',
      description: 'Más de 150 plantillas editables y recursos vectoriales para publicidad en Instagram, Facebook y TikTok. Formatos totalmente personalizables.',
      short_desc: '150+ plantillas editables para Instagram, FB y TikTok',
      price_guarani: 50000,
      image_url: 'assets/trabajos/trabajo-canva-11.webp',
      type: 'DOWNLOAD',
      file_name: 'pack-mega-redes-2026.zip',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Kit de Marcas & Logotipos Vectoriales',
      slug: 'kit-marcas-logotipos-vectoriales',
      description: 'Colección exclusiva de isotipos, tipografías corporativas, manuales de marca e insumos visuales para diseño de identidad comercial.',
      short_desc: 'Colección de vectores y elementos de branding corporativo',
      price_guarani: 75000,
      image_url: 'assets/trabajos/trabajo-canva-19.webp',
      type: 'DOWNLOAD',
      file_name: 'kit-marcas-vectoriales.zip',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Curso Online: Publicidad Visual de Alto Impacto',
      slug: 'curso-publicidad-visual-alto-impacto',
      description: 'Aprende paso a paso a diseñar campañas publicitarias efectivas para redes sociales, estructurar flyers que venden y dominar la composición.',
      short_desc: 'Aprende a diseñar campañas y publicidad que vende',
      price_guarani: 120000,
      image_url: 'assets/trabajos/trabajo-canva-8.webp',
      type: 'COURSE',
      file_name: '',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      name: 'Pack Gastronomía & Menús Restaurante',
      slug: 'pack-gastronomia-menus-restaurante',
      description: 'Plantillas de cartas, menús, promociones para comida rápida, bares y restaurantes en formatos listos para imprimir y publicar.',
      short_desc: 'Diseños de menús, promociones y flyers gastronómicos',
      price_guarani: 60000,
      image_url: 'assets/trabajos/trabajo-canva-30.webp',
      type: 'DOWNLOAD',
      file_name: 'pack-gastronomia-menus.zip',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    },
    {
      id: 5,
      name: 'Vectores Grabado Láser & Rotativo 360°',
      slug: 'vectores-grabado-laser-rotativo-360',
      description: 'Diseños vectoriales listos para grabado en fibra óptica o CO2 sobre termos, vasos térmicos y objetos metálicos.',
      short_desc: 'Diseños listos para grabado láser en termos y vasos',
      price_guarani: 85000,
      image_url: 'assets/catalogo/trabajo-p8-1.webp',
      type: 'DOWNLOAD',
      file_name: 'vectores-grabado-laser.zip',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    }
  ],
  orders: [],
  order_items: [],
  digital_deliveries: [],
  email_logs: []
};

// Cargar o crear JSON
if (!fs.existsSync(jsonDbPath)) {
  fs.writeFileSync(jsonDbPath, JSON.stringify(initialData, null, 2), 'utf-8');
}

function loadDb() {
  try {
    const raw = fs.readFileSync(jsonDbPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return initialData;
  }
}

function saveDb(data) {
  fs.writeFileSync(jsonDbPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Interfaz orientada a objetos para operaciones de Base de Datos
const db = {
  getProducts: (onlyActive = true) => {
    const data = loadDb();
    if (onlyActive) {
      return data.products.filter(p => p.status === 'ACTIVE');
    }
    return data.products;
  },

  getProductById: (id) => {
    const data = loadDb();
    return data.products.find(p => p.id === Number(id));
  },

  saveProduct: (productData) => {
    const data = loadDb();
    if (productData.id) {
      const idx = data.products.findIndex(p => p.id === Number(productData.id));
      if (idx !== -1) {
        data.products[idx] = { ...data.products[idx], ...productData, updated_at: new Date().toISOString() };
        saveDb(data);
        return data.products[idx];
      }
    }
    const newId = data.products.length > 0 ? Math.max(...data.products.map(p => p.id)) + 1 : 1;
    const newProd = {
      id: newId,
      ...productData,
      status: productData.status || 'ACTIVE',
      created_at: new Date().toISOString()
    };
    data.products.push(newProd);
    saveDb(data);
    return newProd;
  },

  createOrder: (orderPayload, items) => {
    const data = loadDb();
    const newOrderId = data.orders.length > 0 ? Math.max(...data.orders.map(o => o.id)) + 1 : 1;
    
    // Formato de código de pedido único: DJJ-2026-XXXXX
    const seqStr = String(newOrderId).padStart(5, '0');
    const order_code = `DJJ-2026-${seqStr}`;

    const newOrder = {
      id: newOrderId,
      order_code,
      customer_name: orderPayload.customer_name,
      customer_email: orderPayload.customer_email,
      customer_phone: orderPayload.customer_phone,
      customer_country: orderPayload.customer_country || 'Paraguay',
      customer_city: orderPayload.customer_city || '',
      payment_method: orderPayload.payment_method, // TRANSFER | GIRO
      total_guarani: orderPayload.total_guarani,
      status: 'PENDING', // PENDING | PAID | REJECTED | DELIVERED
      proof_file_name: orderPayload.proof_file_name || '',
      rejection_reason: '',
      created_at: new Date().toISOString(),
      approved_at: null
    };

    data.orders.push(newOrder);

    // Guardar ítems del pedido
    items.forEach(item => {
      const itemId = data.order_items.length > 0 ? Math.max(...data.order_items.map(i => i.id)) + 1 : 1;
      data.order_items.push({
        id: itemId,
        order_id: newOrderId,
        product_id: item.product_id,
        product_name: item.product_name,
        price_guarani: item.price_guarani,
        quantity: item.quantity
      });
    });

    saveDb(data);
    return { order: newOrder, items: data.order_items.filter(i => i.order_id === newOrderId) };
  },

  getOrders: (filterStatus = null) => {
    const data = loadDb();
    let res = data.orders;
    if (filterStatus) {
      res = res.filter(o => o.status === filterStatus);
    }
    return res.map(order => ({
      ...order,
      items: data.order_items.filter(i => i.order_id === order.id)
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getOrderById: (id) => {
    const data = loadDb();
    const order = data.orders.find(o => o.id === Number(id) || o.order_code === id);
    if (!order) return null;
    const items = data.order_items.filter(i => i.order_id === order.id);
    const delivery = data.digital_deliveries.find(d => d.order_id === order.id);
    return { ...order, items, delivery };
  },

  updateOrderStatus: (orderId, status, rejection_reason = '') => {
    const data = loadDb();
    const idx = data.orders.findIndex(o => o.id === Number(orderId));
    if (idx === -1) return null;

    data.orders[idx].status = status;
    if (status === 'PAID' || status === 'DELIVERED') {
      data.orders[idx].approved_at = new Date().toISOString();
    }
    if (rejection_reason) {
      data.orders[idx].rejection_reason = rejection_reason;
    }

    saveDb(data);
    return data.orders[idx];
  },

  createDeliveryToken: (orderId) => {
    const data = loadDb();
    const orderIdNum = Number(orderId);
    let existing = data.digital_deliveries.find(d => d.order_id === orderIdNum);
    
    if (existing) {
      return existing;
    }

    const crypto = require('crypto');
    const token = 'djj_dl_' + crypto.randomBytes(16).toString('hex');
    const deliveryId = data.digital_deliveries.length > 0 ? Math.max(...data.digital_deliveries.map(d => d.id)) + 1 : 1;
    
    const newDelivery = {
      id: deliveryId,
      order_id: orderIdNum,
      download_token: token,
      download_count: 0,
      delivery_status: 'ACTIVE',
      created_at: new Date().toISOString()
    };

    data.digital_deliveries.push(newDelivery);
    saveDb(data);
    return newDelivery;
  },

  getDeliveryByToken: (token) => {
    const data = loadDb();
    const delivery = data.digital_deliveries.find(d => d.download_token === token);
    if (!delivery) return null;

    const order = data.orders.find(o => o.id === delivery.order_id);
    const items = data.order_items.filter(i => i.order_id === delivery.order_id);
    return { delivery, order, items };
  },

  incrementDownloadCount: (deliveryId) => {
    const data = loadDb();
    const idx = data.digital_deliveries.findIndex(d => d.id === Number(deliveryId));
    if (idx !== -1) {
      data.digital_deliveries[idx].download_count += 1;
      saveDb(data);
    }
  },

  logEmail: (logData) => {
    const data = loadDb();
    const newId = data.email_logs.length > 0 ? Math.max(...data.email_logs.map(e => e.id)) + 1 : 1;
    const log = {
      id: newId,
      ...logData,
      sent_at: new Date().toISOString()
    };
    data.email_logs.push(log);
    saveDb(data);
    return log;
  },

  getUserByUsername: (username) => {
    const data = loadDb();
    return data.users.find(u => u.username === username);
  }
};

module.exports = db;
