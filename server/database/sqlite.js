const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  const missing = new Error('Falta la dependencia better-sqlite3. Ejecuta npm install antes de iniciar el backend.');
  missing.code = 'DATABASE_DRIVER_MISSING';
  throw missing;
}

const databasePath = path.join(__dirname, 'diseno_jj.db');
const legacyJsonPath = path.join(__dirname, 'diseno_jj_data.json');
const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique ON customers(email);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'PYG',
  type TEXT NOT NULL CHECK (type IN ('DOWNLOAD', 'COURSE')),
  image_url TEXT NOT NULL DEFAULT '',
  file_key TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  download_limit INTEGER,
  download_expiry_hours INTEGER,
  version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','FAILED','CANCELLED','DELIVERED')),
  currency TEXT NOT NULL DEFAULT 'PYG',
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  payment_gateway TEXT NOT NULL DEFAULT '',
  external_payment_id TEXT NOT NULL DEFAULT '',
  delivery_status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'PYG',
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  external_transaction_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_reference TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, external_transaction_id)
);
CREATE TABLE IF NOT EXISTS digital_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at TEXT,
  download_limit INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_download_at TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS digital_delivery_order_product_unique ON digital_deliveries(order_id, product_id);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL UNIQUE REFERENCES products(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS course_lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  title TEXT NOT NULL,
  content_key TEXT NOT NULL,
  position INTEGER NOT NULL,
  UNIQUE(course_id, position)
);
CREATE TABLE IF NOT EXISTS course_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id INTEGER NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  UNIQUE(course_id, customer_id, order_id)
);
CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  email_to TEXT NOT NULL,
  email_type TEXT NOT NULL DEFAULT 'UNKNOWN',
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  sent_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS download_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL REFERENCES digital_deliveries(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  external_event_id TEXT,
  external_transaction_id TEXT,
  order_id INTEGER,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  processed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(provider, external_event_id)
);
`);

function now() { return new Date().toISOString(); }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function publicProduct(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, slug: row.slug, short_desc: row.short_description,
    description: row.description, price_guarani: row.price_minor, currency: row.currency,
    type: row.type, image_url: row.image_url, file_name: row.file_name || row.file_key, storage_key: row.file_key,
    mime_type: row.mime_type || '', file_size: row.file_size || 0, status: row.status,
    download_limit: row.download_limit, download_expiry_hours: row.download_expiry_hours,
    version: row.version, created_at: row.created_at, updated_at: row.updated_at
  };
}
function productById(id) { return db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id)); }
function orderItems(orderId) {
  return db.prepare(`SELECT id, order_id, product_id, product_name_snapshot AS product_name,
    unit_price_minor AS price_guarani, currency, quantity FROM order_items WHERE order_id = ?`).all(orderId);
}
function customerForOrder(customerId) { return db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId); }

for (const statement of [
  "ALTER TABLE products ADD COLUMN file_name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE products ADD COLUMN mime_type TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE products ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0"
]) {
  try { db.exec(statement); } catch (error) { if (!String(error.message).includes('duplicate column')) throw error; }
}

function importLegacyJson() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  if (count > 0) return;
  let legacy = null;
  if (fs.existsSync(legacyJsonPath)) {
    try { legacy = JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8')); } catch (error) { legacy = null; }
  }
  const products = legacy?.products || [
    { id: 1, name: 'Pack Mega Redes Sociales 2026', slug: 'pack-mega-redes-sociales-2026', description: 'Más de 150 plantillas editables y recursos vectoriales para publicidad en Instagram, Facebook y TikTok. Formatos totalmente personalizables.', short_desc: '150+ plantillas editables para Instagram, FB y TikTok', price_guarani: 50000, image_url: 'assets/trabajos/trabajo-canva-11.webp', type: 'DOWNLOAD', file_name: 'pack-mega-redes-2026.zip', status: 'ACTIVE' },
    { id: 2, name: 'Kit de Marcas & Logotipos Vectoriales', slug: 'kit-marcas-logotipos-vectoriales', description: 'Colección exclusiva de isotipos, tipografías corporativas, manuales de marca e insumos visuales para diseño de identidad comercial.', short_desc: 'Colección de vectores y elementos de branding corporativo', price_guarani: 75000, image_url: 'assets/trabajos/trabajo-canva-19.webp', type: 'DOWNLOAD', file_name: 'kit-marcas-vectoriales.zip', status: 'ACTIVE' },
    { id: 3, name: 'Curso Online: Publicidad Visual de Alto Impacto', slug: 'curso-publicidad-visual-alto-impacto', description: 'Aprende paso a paso a diseñar campañas publicitarias efectivas para redes sociales, estructurar flyers que venden y dominar la composición.', short_desc: 'Aprende a diseñar campañas y publicidad que vende', price_guarani: 120000, image_url: 'assets/trabajos/trabajo-canva-8.webp', type: 'COURSE', file_name: '', status: 'ACTIVE' },
    { id: 4, name: 'Pack Gastronomía & Menús Restaurante', slug: 'pack-gastronomia-menus-restaurante', description: 'Plantillas de cartas, menús, promociones para comida rápida, bares y restaurantes en formatos listos para imprimir y publicar.', short_desc: 'Diseños de menús, promociones y flyers gastronómicos', price_guarani: 60000, image_url: 'assets/trabajos/trabajo-canva-30.webp', type: 'DOWNLOAD', file_name: 'pack-gastronomia-menus.zip', status: 'ACTIVE' },
    { id: 5, name: 'Vectores Grabado Láser & Rotativo 360°', slug: 'vectores-grabado-laser-rotativo-360', description: 'Diseños vectoriales listos para grabado en fibra óptica o CO2 sobre termos, vasos térmicos y objetos metálicos.', short_desc: 'Diseños listos para grabado láser en termos y vasos', price_guarani: 85000, image_url: 'assets/catalogo/trabajo-p8-1.webp', type: 'DOWNLOAD', file_name: 'vectores-grabado-laser.zip', status: 'ACTIVE' }
  ];
  const insertProduct = db.prepare(`INSERT OR IGNORE INTO products
    (id,name,slug,short_description,description,price_minor,currency,type,image_url,file_key,status,created_at,updated_at)
    VALUES (@id,@name,@slug,@short_description,@description,@price_minor,@currency,@type,@image_url,@file_key,@status,@created_at,@updated_at)`);
  const insert = db.transaction(() => {
    for (const product of products) {
      const created = product.created_at || now();
      insertProduct.run({ id: product.id, name: product.name, slug: product.slug || `product-${product.id}`,
        short_description: product.short_desc || '', description: product.description || '',
        price_minor: Number(product.price_guarani) || 0, currency: 'PYG', type: product.type === 'COURSE' ? 'COURSE' : 'DOWNLOAD',
        image_url: product.image_url || '', file_key: product.file_name || '', status: product.status || 'ACTIVE',
        created_at: created, updated_at: product.updated_at || created });
    }
    db.prepare(`INSERT OR IGNORE INTO courses (product_id,title,description,created_at,updated_at)
      SELECT id,name,description,created_at,updated_at FROM products WHERE type='COURSE'`).run();

    const insertAdmin = db.prepare(`INSERT OR IGNORE INTO admin_users (id,username,password_hash,role,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`);
    for (const user of legacy?.users || []) {
      if (user.username && user.password_hash) insertAdmin.run(user.id, user.username, user.password_hash, user.role || 'admin', 1, user.created_at || now(), user.created_at || now());
    }

    const legacyCustomers = new Map();
    const findOrCreateCustomer = (order) => {
      const email = String(order.customer_email || '').trim().toLowerCase();
      if (!email) return null;
      if (legacyCustomers.has(email)) return legacyCustomers.get(email);
      const existing = db.prepare('SELECT id FROM customers WHERE email=?').get(email);
      if (existing) { legacyCustomers.set(email, existing.id); return existing.id; }
      const result = db.prepare(`INSERT INTO customers (full_name,email,phone,country,city,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
        .run(order.customer_name || 'Cliente migrado', email, order.customer_phone || '', order.customer_country || '', order.customer_city || '', order.created_at || now(), order.created_at || now());
      legacyCustomers.set(email, Number(result.lastInsertRowid));
      return Number(result.lastInsertRowid);
    };
    for (const order of legacy?.orders || []) {
      const customerId = findOrCreateCustomer(order);
      if (!customerId) continue;
      const exists = db.prepare('SELECT id FROM orders WHERE order_code=?').get(order.order_code || `DJJ-MIGRATED-${order.id}`);
      if (exists) continue;
      const inserted = db.prepare(`INSERT INTO orders (id,order_code,customer_id,status,currency,total_minor,payment_gateway,external_payment_id,delivery_status,paid_at,delivered_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(order.id, order.order_code || `DJJ-MIGRATED-${order.id}`, customerId, order.status || 'PENDING', 'PYG', order.total_guarani || 0, order.payment_gateway || '', order.transaction_id || '', order.delivery_status || 'PENDING', order.paid_at || null, order.delivered_at || null, order.created_at || now(), order.updated_at || order.created_at || now());
      const itemRows = (legacy.order_items || []).filter(item => item.order_id === order.id);
      const insertItem = db.prepare(`INSERT INTO order_items (order_id,product_id,product_name_snapshot,unit_price_minor,currency,quantity) VALUES (?,?,?,?,?,?)`);
      for (const item of itemRows) insertItem.run(inserted.lastInsertRowid, item.product_id, item.product_name || '', item.price_guarani || 0, 'PYG', Math.max(1, Number(item.quantity) || 1));
    }
  });
  insert();
}
importLegacyJson();
db.prepare(`INSERT OR IGNORE INTO courses (product_id,title,description,created_at,updated_at)
  SELECT id,name,description,created_at,updated_at FROM products WHERE type='COURSE'`).run();

const repository = {
  getProducts(onlyActive = true) {
    const rows = db.prepare(`SELECT * FROM products ${onlyActive ? "WHERE status = 'ACTIVE'" : ''} ORDER BY id`).all();
    return rows.map(publicProduct);
  },
  getProductById(id) { return publicProduct(productById(id)); },
  saveProduct(data) {
    const timestamp = now();
    const existing = data.id ? productById(data.id) : null;
    if (existing) {
      db.prepare(`UPDATE products SET name=@name, slug=@slug, short_description=@short_description, description=@description,
        price_minor=@price_minor, currency=@currency, type=@type, image_url=@image_url, file_key=@file_key,
        status=@status, updated_at=@updated_at WHERE id=@id`).run({
        id: existing.id, name: data.name, slug: data.slug, short_description: data.short_desc || '', description: data.description || '',
        price_minor: Number(data.price_guarani), currency: data.currency || 'PYG', type: data.type === 'COURSE' ? 'COURSE' : 'DOWNLOAD',
        image_url: data.image_url || '', file_key: data.file_name || '', status: data.status || 'ACTIVE', updated_at: timestamp
      });
      return publicProduct(productById(existing.id));
    }
    const result = db.prepare(`INSERT INTO products (name,slug,short_description,description,price_minor,currency,type,image_url,file_key,status,created_at,updated_at)
      VALUES (@name,@slug,@short_description,@description,@price_minor,@currency,@type,@image_url,@file_key,@status,@created_at,@updated_at)`).run({
      name: data.name, slug: data.slug, short_description: data.short_desc || '', description: data.description || '',
      price_minor: Number(data.price_guarani), currency: data.currency || 'PYG', type: data.type === 'COURSE' ? 'COURSE' : 'DOWNLOAD',
      image_url: data.image_url || '', file_key: data.file_name || '', status: data.status || 'ACTIVE', created_at: timestamp, updated_at: timestamp
    });
    return publicProduct(productById(result.lastInsertRowid));
  },
  setProductFile(productId, file) {
    const result = db.prepare(`UPDATE products SET file_key=?,file_name=?,mime_type=?,file_size=?,updated_at=? WHERE id=?`)
      .run(file.storage_key, file.filename, file.mime_type, file.size, now(), Number(productId));
    return result.changes ? publicProduct(productById(productId)) : null;
  },
  createOrder(payload, items) {
    const timestamp = now();
    const normalizedEmail = payload.customer_email.trim().toLowerCase();
    const transaction = db.transaction(() => {
      let customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(normalizedEmail);
      if (customer) {
        db.prepare('UPDATE customers SET full_name=?, phone=?, country=?, city=?, updated_at=? WHERE id=?')
          .run(payload.customer_name, payload.customer_phone, payload.customer_country || '', payload.customer_city || '', timestamp, customer.id);
      } else {
        const result = db.prepare(`INSERT INTO customers (full_name,email,phone,country,city,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
          .run(payload.customer_name, normalizedEmail, payload.customer_phone, payload.customer_country || '', payload.customer_city || '', timestamp, timestamp);
        customer = customerForOrder(result.lastInsertRowid);
      }
      const result = db.prepare(`INSERT INTO orders (order_code,customer_id,status,currency,total_minor,payment_gateway,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)`).run('TEMP', customer.id, 'PENDING', payload.currency || 'PYG', payload.total_guarani, payload.payment_gateway || '', timestamp, timestamp);
      const orderId = Number(result.lastInsertRowid);
      const orderCode = `DJJ-${new Date().getUTCFullYear()}-${String(orderId).padStart(5, '0')}`;
      db.prepare('UPDATE orders SET order_code=? WHERE id=?').run(orderCode, orderId);
      const insertItem = db.prepare(`INSERT INTO order_items (order_id,product_id,product_name_snapshot,unit_price_minor,currency,quantity) VALUES (?,?,?,?,?,?)`);
      items.forEach(item => insertItem.run(orderId, item.product_id, item.product_name, item.price_guarani, item.currency || 'PYG', item.quantity));
      return { id: orderId, order_code: orderCode };
    });
    const created = transaction();
    return { order: this.getOrderById(created.order_code), items: orderItems(created.id) };
  },
  getOrders(filterStatus = null) {
    const rows = db.prepare(`SELECT o.*, c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
      FROM orders o JOIN customers c ON c.id=o.customer_id ${filterStatus && filterStatus !== 'ALL' ? 'WHERE o.status = ?' : ''} ORDER BY o.created_at DESC`)
      .all(...(filterStatus && filterStatus !== 'ALL' ? [filterStatus] : []));
    return rows.map(row => ({ ...row, total_guarani: row.total_minor, items: orderItems(row.id), delivery: db.prepare('SELECT * FROM digital_deliveries WHERE order_id=?').get(row.id) || null }));
  },
  getOrderById(id) {
    const row = db.prepare(`SELECT o.*, c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
      c.country AS customer_country, c.city AS customer_city FROM orders o JOIN customers c ON c.id=o.customer_id
      WHERE o.id = ? OR o.order_code = ?`).get(Number(id) || -1, String(id));
    if (!row) return null;
    return { ...row, total_guarani: row.total_minor, items: orderItems(row.id), delivery: db.prepare('SELECT * FROM digital_deliveries WHERE order_id=?').get(row.id) || null };
  },
  markOrderAsPaid() { return { error: 'Los pagos están bloqueados hasta integrar un proveedor oficial.' }; },
  createDigitalDeliveries(orderId) {
    const order = this.getOrderById(orderId);
    if (!order || !['PAID', 'DELIVERED'].includes(order.status)) return { created: [], error: 'ORDER_NOT_PAID' };
    const created = [];
    const transaction = db.transaction(() => {
      for (const item of order.items) {
        const product = productById(item.product_id);
        if (!product || product.type !== 'DOWNLOAD') continue;
        const existing = db.prepare('SELECT * FROM digital_deliveries WHERE order_id=? AND product_id=?').get(order.id, product.id);
        if (existing) { created.push({ delivery: existing, token: null, existing: true }); continue; }
        const token = crypto.randomBytes(32).toString('base64url');
        const expires = product.download_expiry_hours ? new Date(Date.now() + product.download_expiry_hours * 3600000).toISOString() : null;
        const result = db.prepare(`INSERT INTO digital_deliveries (order_id,product_id,token_hash,status,expires_at,download_limit,created_at)
          VALUES (?,?,?,?,?,?,?)`).run(order.id, product.id, hashToken(token), 'ACTIVE', expires, product.download_limit, now());
        created.push({ delivery: db.prepare('SELECT * FROM digital_deliveries WHERE id=?').get(result.lastInsertRowid), token, existing: false });
      }
    });
    transaction();
    return { created };
  },
  grantCourseAccess(orderId) {
    const order = this.getOrderById(orderId);
    if (!order || !['PAID', 'DELIVERED'].includes(order.status)) return { granted: [], error: 'ORDER_NOT_PAID' };
    const granted = [];
    const transaction = db.transaction(() => {
      for (const item of order.items) {
        const course = db.prepare(`SELECT c.* FROM courses c JOIN products p ON p.id=c.product_id WHERE p.id=? AND p.type='COURSE'`).get(item.product_id);
        if (!course) continue;
        const existing = db.prepare('SELECT * FROM course_access WHERE course_id=? AND customer_id=? AND order_id=?').get(course.id, order.customer_id, order.id);
        if (existing) { granted.push(existing); continue; }
        const result = db.prepare(`INSERT INTO course_access (course_id,customer_id,order_id,status,created_at) VALUES (?,?,?,?,?)`).run(course.id, order.customer_id, order.id, 'ACTIVE', now());
        granted.push(db.prepare('SELECT * FROM course_access WHERE id=?').get(result.lastInsertRowid));
      }
    });
    transaction();
    return { granted };
  },
  getDeliveryByToken(token) {
    const delivery = db.prepare('SELECT * FROM digital_deliveries WHERE token_hash=?').get(hashToken(token));
    if (!delivery) return null;
    const order = this.getOrderById(delivery.order_id);
    return { delivery, order, items: orderItems(delivery.order_id) };
  },
  incrementDownloadCount(deliveryId, context = {}) {
    const timestamp = now();
    const update = db.prepare('UPDATE digital_deliveries SET download_count=download_count+1,last_download_at=? WHERE id=?');
    update.run(timestamp, deliveryId);
    db.prepare('INSERT INTO download_logs (delivery_id,ip_address,user_agent,created_at) VALUES (?,?,?,?)')
      .run(deliveryId, context.ip || '', context.userAgent || '', timestamp);
  },
  createDeliveryToken() { return null; },
  logEmail(data) {
    const timestamp = now();
    return db.prepare(`INSERT INTO email_logs (order_id,email_to,email_type,subject,status,error_message,sent_at,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(data.order_id || null, data.email_to, data.email_type || 'UNKNOWN', data.subject || '', data.status, data.error_message || '', data.status === 'EMAIL_SENT' ? timestamp : null, timestamp);
  },
  getUserByUsername(username) { return db.prepare('SELECT * FROM admin_users WHERE username=? AND active=1').get(username); },
  getDashboardMetrics() {
    const metrics = db.prepare(`SELECT COUNT(*) AS total_orders,
      SUM(CASE WHEN status IN ('PAID','DELIVERED') THEN 1 ELSE 0 END) AS paid_orders_count,
      SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending_orders_count,
      COALESCE(SUM(CASE WHEN status IN ('PAID','DELIVERED') THEN total_minor ELSE 0 END),0) AS total_income
      FROM orders`).get();
    return {
      ...metrics,
      today_income: 0,
      month_income: 0,
      active_products_count: db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='ACTIVE'").get().count,
      deliveries_count: db.prepare("SELECT COUNT(*) AS count FROM digital_deliveries WHERE status='ACTIVE'").get().count,
      failed_emails_count: db.prepare("SELECT COUNT(*) AS count FROM email_logs WHERE status='EMAIL_FAILED'").get().count,
      total_downloads_count: db.prepare('SELECT COALESCE(SUM(download_count),0) AS count FROM digital_deliveries').get().count
    };
  },
  getCustomers() { return db.prepare('SELECT id,full_name,email,phone,country,city,created_at,updated_at FROM customers ORDER BY created_at DESC').all(); },
  getDeliveries() { return db.prepare('SELECT d.id,d.order_id,d.product_id,d.status,d.expires_at,d.download_limit,d.download_count,d.last_download_at,d.created_at,o.order_code,p.name AS product_name FROM digital_deliveries d JOIN orders o ON o.id=d.order_id JOIN products p ON p.id=d.product_id ORDER BY d.created_at DESC').all(); },
  getEmailLogs() { return db.prepare('SELECT * FROM email_logs ORDER BY created_at DESC').all(); },
  getCourses() { return db.prepare('SELECT c.*,p.name AS product_name FROM courses c JOIN products p ON p.id=c.product_id ORDER BY c.created_at DESC').all(); }
};

module.exports = repository;
