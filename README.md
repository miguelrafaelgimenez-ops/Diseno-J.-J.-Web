# Central Digital & Sistema de Ventas Digitales Automático — Diseño J. J.

> **"Somos tu aliado creativo"**  
> Sitio web oficial, portafolio de diseño, catálogo comercial y plataforma de **ventas online 100% automatizadas con entrega digital inmediata** para **Diseño J. J.** (Paraguay).

---

## 🚀 Flujo de Compra y Entrega 100% Automatizado

Sin intervención manual del administrador para cada compra:

```text
CLIENTE
  ↓
1. Selecciona Producto / Pack / Curso en tienda.html
  ↓
2. Carrito de Compras (cart.js) con cálculo dinámico en Guaraníes (₲)
  ↓
3. Checkout Seguro (checkout.html) con confirmación de correo
  ↓
4. POST /api/orders/create (El servidor valida precios reales y genera sesión de pago)
  ↓
5. Pasarela de Pago Oficial (Tarjetas Débito/Crédito / Bancard / Pagopar)
  ↓
6. Pasarela aprueba el pago -> Envía Webhook a POST /api/payments/webhook
  ↓
7. Backend valida firma criptográfica, verifica orden e ID de transacción
  ↓
8. Pedido marcado como PAID (Idempotencia garantizada)
  ↓
9. Generación de Token de Entrega Único (/api/download/:token)
  ↓
10. Nodemailer envía correo automático al cliente con enlace de Descarga / Acceso al Curso
  ↓
CLIENTE DESCARGA SU ARCHIVO O ACCEDE A SU CURSO
```

---

## 🎨 Identidad Visual y Tecnologías

- **Paleta Oficial:** Azul oscuro (`#040714`, `#070d1e`, `#0b142d`), Azul eléctrico (`#00d2ff`, `#0066ff`), Blanco de alto contraste y acentos dorados (`#e5b869`).
- **Tipografía:** Google Fonts (*Outfit* para títulos y *Plus Jakarta Sans* para textos).
- **Frontend:** HTML5 semántico, CSS3 nativo (Variables CSS, Flexbox, Grid responsive) y JavaScript Vanilla modular.
- **Backend:** Node.js, Express, Webhooks criptográficos HMAC SHA-256, JWT para administración y Nodemailer (SMTP).
- **Persistencia:** Base de datos relacional y estructurada (`server/database/db.js`).

---

## 📄 Mapa de Páginas y Módulos

| Módulo / Página | Propósito | Descripción |
| :--- | :--- | :--- |
| 🏠 **[index.html](index.html)** | **Central Digital** | Hero, Servicios principales, Muestra de Trabajos, Lo Último, Síguenos en Redes (FB, IG, TikTok), Contacto y Carrito. |
| 🎨 **[trabajos.html](trabajos.html)** | **Portafolio Creativo** | Galería completa de trabajos reales: Flyers, Redes Sociales, Gastronomía, Eventos, Branding y Promocionales con Lightbox. |
| 📦 **[catalogo.html](catalogo.html)** | **Catálogo Comercial** | Catálogo comercial de equipos (DTF, grabadoras láser fibra/portátil), combos de sublimación e insumos. |
| 🛒 **[tienda.html](tienda.html)** | **Tienda Digital** | Catálogo interactivo de productos digitales descargables (packs, vectores, plantillas) y cursos online en Guaraníes. |
| 💳 **[checkout.html](checkout.html)** | **Checkout Online** | Formulario de facturación, confirmación de correo y conexión directa a pasarela de pagos. |
| ✅ **[confirmacion.html](confirmacion.html)** | **Estado de Compra** | Verificación en tiempo real del Webhook y botón de descarga directa inmediata. |
| 🔒 **[admin/index.html](admin/index.html)** | **Panel de Ventas** | Dashboard con métricas automáticas (Ventas de Hoy, Mes, Total Ingresos, Pedidos Confirmados) y reenvío de correos. |
| 📦 **[admin/productos.html](admin/productos.html)** | **Gestión Productos** | Crear, editar y administrar precios, descripciones y tipos de productos digitales. |

---

## ⚙️ Instalación y Configuración para Producción

### 1. Clonar e Instalar Dependencias
```bash
npm install
```

### 2. Variables de Entorno (`.env`)
Copia `.env.example` a `.env` y configura tus credenciales reales:
```env
PORT=5000
NODE_ENV=production
BASE_URL=https://tudominio.com
JWT_SECRET=clave_secreta_jwt_para_admin

# PASARELA DE PAGO (PARAGUAY & INTERNACIONAL)
PAYMENT_GATEWAY=PAGOPAR
PAYMENT_PUBLIC_KEY=tu_public_key_de_pasarela
PAYMENT_PRIVATE_KEY=tu_private_key_de_pasarela
PAYMENT_WEBHOOK_SECRET=tu_secreto_para_firma_de_webhook

# SERVIDOR DE CORREO ELECTRÓNICO (SMTP / GMAIL)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_app_password
EMAIL_FROM="Diseño J. J. <tu_correo@gmail.com>"

# ACCESO ADMINISTRADOR POR DEFECTO
ADMIN_USER=admin
ADMIN_PASS=admin_password_seguro
```

### 3. Iniciar Servidor
```bash
npm start
```

---

## 🔒 Seguridad y Prevención de Fraude
- **Validación de Precios en Servidor:** El servidor recalcula siempre los importes desde la base de datos, impidiendo alteraciones desde herramientas de desarrollador en el navegador.
- **Validación Criptográfica de Webhooks:** Se valida la firma HMAC SHA-256 o hash de la pasarela antes de procesar cualquier notificación de pago.
- **Idempotencia Estricta:** Las notificaciones duplicadas de webhooks se reconocen y no duplican entregas ni envíos de correos.
- **Archivos Protegidos:** Los archivos descargables se almacenan en `storage/digital_files/` y únicamente se sirven a través de tokens únicos temporales generados tras confirmarse el pago.

---

© 2026 **Diseño J. J.** — *Somos tu aliado creativo.*
