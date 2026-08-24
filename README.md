# Central Digital & Sistema de Ventas Digitales — Diseño J. J.

> **"Somos tu aliado creativo"**  
> Sitio web oficial, portafolio de diseño, catálogo comercial y plataforma integral de **ventas de productos digitales y cursos** de **Diseño J. J.** (Paraguay).

---

## 🎨 Identidad Visual y Tecnologías

- **Paleta Oficial:** Azul oscuro (`#040714`, `#070d1e`, `#0b142d`), Azul eléctrico (`#00d2ff`, `#0066ff`), Blanco de alto contraste y acentos dorados (`#e5b869`).
- **Tipografía:** Google Fonts (*Outfit* para títulos de impacto y *Plus Jakarta Sans* para lectura limpia).
- **Frontend:** HTML5 semántico, CSS3 nativo (Variables CSS, Flexbox, Grid responsive) y JavaScript Vanilla modular.
- **Backend:** Node.js, Express, Multer (almacenamiento seguro de comprobantes), JSON Web Tokens (JWT) y Nodemailer (SMTP).
- **Persistencia:** Base de datos relacional/JSON estructurada (`server/database/db.js`).

---

## 📄 Mapa de Páginas y Módulos

| Módulo / Página | Propósito | Descripción |
| :--- | :--- | :--- |
| 🏠 **[index.html](index.html)** | **Central Digital** | Hero, Servicios principales, Muestra de Trabajos, Lo Último, Síguenos en Redes (FB, IG, TikTok), Contacto y Carrito. |
| 🎨 **[trabajos.html](trabajos.html)** | **Portafolio Creativo** | Galería completa de trabajos reales: Flyers, Redes Sociales, Gastronomía, Eventos, Branding y Promocionales con Lightbox. |
| 📦 **[catalogo.html](catalogo.html)** | **Catálogo Comercial** | Catálogo comercial de equipos (DTF, grabadoras láser fibra/portátil), combos de sublimación e insumos. |
| 🛒 **[tienda.html](tienda.html)** | **Tienda Digital** | Catálogo interactivo de productos digitales descargables (packs, vectores, plantillas) y cursos online. |
| 💳 **[checkout.html](checkout.html)** | **Finalizar Compra** | Formulario de datos de facturación, selección de Transferencia o Giro y carga privada de comprobante. |
| ✅ **[confirmacion.html](confirmacion.html)** | **Confirmación** | Pantalla de estado del pedido con código de seguimiento (`DJJ-2026-XXXXX`). |
| 🔒 **[admin/index.html](admin/index.html)** | **Panel de Ventas** | Dashboard con métricas, lista de pedidos, revisión de comprobantes, aprobación y rechazo. |
| 📦 **[admin/productos.html](admin/productos.html)** | **Gestión Productos** | Crear, editar y administrar precios, descripciones y tipos de productos digitales. |

---

## 🔄 Flujo de Compra y Entrega Digital

```text
CLIENTE: Elige Producto -> Agrega al Carrito -> Checkout -> Paga por Transferencia o Giro -> Sube Comprobante -> Pedido PENDIENTE
                                                                                                                        ↓
ADMINISTRADOR: Ingresa a /admin -> Revisa Pedido & Comprobante -> [APROBAR PAGO] o [RECHAZAR PAGO]
                                                                          ↓
ENTREGA: Generación de Enlace Seguro (/api/download/:token) -> Correo Automático al Cliente con enlace de Descarga / Acceso
```

---

## ⚙️ Instalación y Configuración

### 1. Clonar e Instalar Dependencias
```bash
npm install
```

### 2. Variables de Entorno (`.env`)
Copia `.env.example` a `.env` y configura los valores requeridos:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=tu_clave_secreta_jwt_para_admin

# DATOS BANCARIOS (PARAGUAY)
TRANSFER_BANK=Visión Banco / Itaú
TRANSFER_ACCOUNT=00000000000
TRANSFER_OWNER=Diseño J. J.
TRANSFER_DOC=8000000-0

# DATOS DE GIRO MÓVIL (PARAGUAY)
GIRO_NAME=Diseño J. J.
GIRO_DOCUMENT=8000000-0
GIRO_PHONE=(0983) 828 584 / (0984) 828 584

# SERVIDOR DE CORREO ELECTRÓNICO (SMTP / GMAIL)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_app_password
EMAIL_FROM="Diseño J. J. <tu_correo@gmail.com>"

# ACCESO ADMINISTRADOR POR DEFECTO
ADMIN_USER=admin
ADMIN_PASS=admin123
```

### 3. Ejecutar el Servidor
```bash
npm start
```
Acceder a `http://localhost:5000` (o al puerto configurado).

---

## 🔒 Almacenamiento Privado y Seguridad
- **Comprobantes de Pago:** Se guardan en `storage/payment_proofs/` y únicamente son accesibles por administradores autenticados mediante `/api/admin/proofs/:fileName`.
- **Productos Digitales:** Se almacenan en `storage/digital_files/` protegidos contra accesos directos no autorizados.
- **Validación de Precios:** Los importes se recalculan en el servidor directamente desde la base de datos, impidiendo alteraciones desde el frontend.

---

## 🌐 Enlaces y Redes Oficiales

- **WhatsApp Oficial:** [wa.me/message/6LEPZNC677UDD1](https://wa.me/message/6LEPZNC677UDD1)
- **Instagram:** [instagram.com/marketing_designjj](https://www.instagram.com/marketing_designjj/)
- **Facebook:** [facebook.com/mktgraficos](https://www.facebook.com/mktgraficos/)
- **TikTok:** [tiktok.com/@desingjj](https://www.tiktok.com/@desingjj?lang=es)
- **Teléfonos:** `(0983) 828 584` / `(0984) 828 584`

---

© 2026 **Diseño J. J.** — *Somos tu aliado creativo.*
