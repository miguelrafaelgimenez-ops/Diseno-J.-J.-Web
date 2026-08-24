const nodemailer = require('nodemailer');
const db = require('../database/db');
require('dotenv').config();

// Configuración del servicio de correo
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 465;
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '"Diseño J. J." <noreply@disenojj.com>';

function createTransporter() {
  if (!EMAIL_USER || !EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
}

// FORMATO DE MONEDA GUARANÍ
function formatGuarani(amount) {
  return '₲ ' + Number(amount).toLocaleString('es-PY');
}

// 1. CORREO: PEDIDO RECIBIDO (PAGO PENDIENTE)
async function sendOrderCreatedEmail(order, items) {
  const subject = `Pedido Recibido (${order.order_code}) — Diseño J. J.`;
  const itemsHtml = items.map(i => `<li><b>${i.product_name}</b> x${i.quantity} — ${formatGuarani(i.price_guarani * i.quantity)}</li>`).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #040714; color: #f1f5f9; padding: 25px; border-radius: 12px;">
      <h2 style="color: #00d2ff; font-size: 22px; margin-bottom: 5px;">¡Hola, ${order.customer_name}! 👋</h2>
      <p style="font-size: 15px; color: #cbd5e1;">Hemos recibido tu pedido en <b>Diseño J. J.</b> y tu comprobante de pago está en proceso de verificación.</p>
      
      <div style="background-color: #0b142d; padding: 18px; border-radius: 8px; border: 1px solid rgba(0, 210, 255, 0.2); margin: 20px 0;">
        <h3 style="color: #ffffff; margin-top: 0;">Detalles del Pedido: ${order.order_code}</h3>
        <p><b>Estado:</b> <span style="color: #e5b869; font-weight: bold;">PAGO PENDIENTE DE VERIFICACIÓN</span></p>
        <p><b>Método de Pago:</b> ${order.payment_method === 'TRANSFER' ? 'Transferencia Bancaria' : 'Giro Móvil'}</p>
        <ul style="padding-left: 20px;">
          ${itemsHtml}
        </ul>
        <h3 style="color: #00d2ff;">Total: ${formatGuarani(order.total_guarani)}</h3>
      </div>

      <p style="font-size: 14px; color: #94a3b8;">Una vez que nuestro equipo confirme el pago por transferencia/giro, recibirás un nuevo correo con el enlace seguro de descarga de tu producto o acceso a tu curso.</p>

      <hr style="border: 0; border-top: 1px solid rgba(0,210,255,0.2); margin: 25px 0;" />
      <p style="font-size: 13px; color: #64748b; text-align: center;">Diseño J. J. — <i>"Somos tu aliado creativo"</i></p>
    </div>
  `;

  return await deliverEmail(order.id, order.customer_email, subject, html);
}

// 2. CORREO: PAGO APROBADO Y ENTREGA DIGITAL
async function sendPaymentApprovedEmail(order, items, deliveryToken, baseUrl) {
  const subject = `¡Tu compra en Diseño J. J. está lista! (${order.order_code})`;
  const downloadUrl = `${baseUrl}/api/download/${deliveryToken}`;
  
  const itemsHtml = items.map(i => `
    <li style="margin-bottom: 10px;">
      <b>${i.product_name}</b><br/>
      <a href="${downloadUrl}" style="display: inline-block; margin-top: 6px; padding: 8px 16px; background-color: #00d2ff; color: #040915; font-weight: bold; text-decoration: none; border-radius: 20px;">DESCARGAR / ACCEDER</a>
    </li>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #040714; color: #f1f5f9; padding: 25px; border-radius: 12px;">
      <h2 style="color: #00d2ff; font-size: 24px; margin-bottom: 5px;">¡Gracias por tu compra, ${order.customer_name}! 🎉</h2>
      <p style="font-size: 16px; color: #25d366; font-weight: bold;">Tu pago por ${formatGuarani(order.total_guarani)} fue confirmado exitosamente.</p>
      
      <div style="background-color: #0b142d; padding: 20px; border-radius: 10px; border: 1px solid #00d2ff; margin: 20px 0;">
        <h3 style="color: #ffffff; margin-top: 0;">Tus Productos Comprados (Pedido ${order.order_code}):</h3>
        <ul style="list-style-type: none; padding-left: 0;">
          ${itemsHtml}
        </ul>
      </div>

      <p style="font-size: 14px; color: #cbd5e1;">Puedes descargar tus productos directamente desde el botón superior en cualquier momento.</p>

      <hr style="border: 0; border-top: 1px solid rgba(0,210,255,0.2); margin: 25px 0;" />
      <p style="font-size: 13px; color: #64748b; text-align: center;">Diseño J. J. — <i>"Somos tu aliado creativo"</i></p>
    </div>
  `;

  return await deliverEmail(order.id, order.customer_email, subject, html);
}

// 3. CORREO: PAGO RECHAZADO
async function sendPaymentRejectedEmail(order, reason) {
  const subject = `Notificación sobre tu pedido ${order.order_code} — Diseño J. J.`;

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #040714; color: #f1f5f9; padding: 25px; border-radius: 12px;">
      <h2 style="color: #ff4d4d; font-size: 22px; margin-bottom: 5px;">Hola, ${order.customer_name}</h2>
      <p style="font-size: 15px; color: #cbd5e1;">Tu comprobante de pago para el pedido <b>${order.order_code}</b> no pudo ser verificado.</p>
      
      <div style="background-color: #1a080d; padding: 18px; border-radius: 8px; border: 1px solid #ff4d4d; margin: 20px 0;">
        <p style="color: #ff9999; margin: 0;"><b>Motivo:</b> ${reason || 'El comprobante subido no coincide con el monto o la transferencia requerida.'}</p>
      </div>

      <p style="font-size: 14px; color: #cbd5e1;">Si crees que esto es un error o necesitas ayuda, contáctanos directamente por WhatsApp:</p>
      <p style="text-align: center;">
        <a href="https://wa.me/message/6LEPZNC677UDD1" style="display: inline-block; padding: 10px 22px; background-color: #25d366; color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 20px;">CONTACTAR POR WHATSAPP</a>
      </p>

      <hr style="border: 0; border-top: 1px solid rgba(0,210,255,0.2); margin: 25px 0;" />
      <p style="font-size: 13px; color: #64748b; text-align: center;">Diseño J. J. — <i>"Somos tu aliado creativo"</i></p>
    </div>
  `;

  return await deliverEmail(order.id, order.customer_email, subject, html);
}

// FUNCIÓN AUXILIAR DE ENVÍO
async function deliverEmail(orderId, to, subject, html) {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log(`[SIMULACIÓN EMAIL] Hacia: ${to} | Asunto: ${subject}`);
    db.logEmail({
      order_id: orderId,
      email_to: to,
      subject,
      status: 'SIMULATED',
      error_message: 'Servidor SMTP no configurado en .env (Simulación limpia)'
    });
    return { success: true, simulated: true };
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html
    });

    db.logEmail({
      order_id: orderId,
      email_to: to,
      subject,
      status: 'SENT',
      error_message: ''
    });

    return { success: true, simulated: false };
  } catch (error) {
    console.error('[ERROR ENVÍO EMAIL]', error.message);
    db.logEmail({
      order_id: orderId,
      email_to: to,
      subject,
      status: 'FAILED',
      error_message: error.message
    });
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendOrderCreatedEmail,
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail
};
