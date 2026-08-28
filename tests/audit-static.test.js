const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('el servicio de pagos permanece bloqueado sin adaptador', () => {
  const source = read('server/services/payment.js');
  assert.match(source, /isConfigured:\s*\(\)\s*=>\s*false/);
  assert.match(source, /return false/);
  assert.doesNotMatch(source, /admin123|SIMULATED|fake-payment/i);
});

test('la API bloquea el webhook antes de procesar eventos', () => {
  const source = read('server/routes/api.js');
  assert.match(source, /!paymentService\.isConfigured\(\)/);
  assert.match(source, /status\(503\)/);
});

test('las entregas privadas no se sirven como estáticos', () => {
  const source = read('server/server.js');
  assert.match(source, /blocked\s*=\s*\[['"]\/storage['"]/);
  const storage = read('server/services/storage.js');
  assert.match(storage, /path\.resolve/);
  assert.match(storage, /startsWith/);
});

test('el esquema impone idempotencia de entregas y accesos', () => {
  const schema = read('server/database/schema.sql');
  assert.match(schema, /UNIQUE\s*\(order_id,\s*product_id\)/i);
  assert.match(schema, /UNIQUE\s*\(course_id,\s*customer_id,\s*order_id\)/i);
});
