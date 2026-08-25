const test = require('node:test');
const assert = require('node:assert/strict');
const payment = require('../server/services/payment');

test('la pasarela permanece bloqueada sin adaptador oficial', async () => {
  assert.equal(payment.isConfigured(), false);
  await assert.rejects(
    () => payment.createPaymentSession({ order_code: 'TEST', total_guarani: 1 }, []),
    error => error.code === 'PAYMENT_GATEWAY_NOT_CONFIGURED'
  );
});

test('un webhook sin adaptador no se considera auténtico', () => {
  assert.equal(payment.verifyWebhookSignature({ status: 'APPROVED' }, 'fake'), false);
});
