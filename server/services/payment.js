require('dotenv').config();


/**
 * Genera la sesión de pago o URL de checkout en la pasarela
 * @param {Object} order Pedido creado en base de datos
 * @param {Array} items Lista de ítems del pedido
 */
async function createPaymentSession(order, items) {
  const error = new Error('La pasarela de pago no está configurada con un adaptador oficial.');
  error.code = 'PAYMENT_GATEWAY_NOT_CONFIGURED';
  error.statusCode = 503;
  throw error;
}

/**
 * Valida la autenticidad de la firma enviada en el Webhook
 */
function verifyWebhookSignature(payload, signatureHeader) {
  // La firma depende del proveedor oficial y no se puede inventar aquí.
  // Hasta instalar un adaptador documentado, todo webhook se rechaza.
  return false;
}

class PaymentGatewayAdapter {
  constructor() {
    this.name = '';
    this.configured = false;
  }

  configurationError() {
    const error = new Error('La pasarela de pago no está configurada con un adaptador oficial.');
    error.code = 'PAYMENT_GATEWAY_NOT_CONFIGURED';
    error.statusCode = 503;
    return error;
  }

  async createCheckout() { throw this.configurationError(); }
  async verifyPayment() { throw this.configurationError(); }
  validateWebhook() { return false; }
  normalizeStatus() { throw this.configurationError(); }
  async getTransaction() { throw this.configurationError(); }
}

module.exports = {
  PaymentGatewayAdapter,
  createPaymentSession,
  verifyWebhookSignature,
  isConfigured: () => false
};
