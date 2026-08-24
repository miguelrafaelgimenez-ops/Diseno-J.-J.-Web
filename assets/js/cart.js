// ==========================================================================
// MÓDULO DEL CARRITO DE COMPRAS — DISEÑO J. J. (JS VANILLA)
// ==========================================================================

const CART_STORAGE_KEY = 'diseno_jj_cart_2026';

// Formatear montos en Guaraníes (₲ 50.000)
function formatGuarani(amount) {
  return '₲ ' + Number(amount).toLocaleString('es-PY');
}

// Obtener carrito de localStorage
function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Guardar carrito en localStorage
function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartBadges();
}

// Agregar producto al carrito
function addToCart(product, quantity = 1, showNotification = true) {
  let cart = getCart();
  const existingIdx = cart.findIndex(item => Number(item.id) === Number(product.id));

  if (existingIdx !== -1) {
    cart[existingIdx].quantity += quantity;
  } else {
    cart.push({
      id: Number(product.id),
      name: product.name || product.titulo,
      price_guarani: Number(product.price_guarani || product.precio || 0),
      image_url: product.image_url || product.imagen || 'assets/logo.png',
      type: product.type || 'DOWNLOAD',
      short_desc: product.short_desc || product.descripcion || '',
      quantity: quantity
    });
  }

  saveCart(cart);

  if (showNotification) {
    showCartToast(`¡"${product.name || product.titulo}" se agregó al carrito!`);
  }
}

// Remover producto del carrito
function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(item => Number(item.id) !== Number(productId));
  saveCart(cart);
  renderCartDrawer();
}

// Actualizar cantidad de un producto
function updateCartQuantity(productId, newQty) {
  let cart = getCart();
  const idx = cart.findIndex(item => Number(item.id) === Number(productId));
  if (idx !== -1) {
    if (newQty <= 0) {
      cart.splice(idx, 1);
    } else {
      cart[idx].quantity = Number(newQty);
    }
    saveCart(cart);
    renderCartDrawer();
  }
}

// Vaciar carrito
function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
  updateCartBadges();
  renderCartDrawer();
}

// Calcular total del carrito
function getCartTotals() {
  const cart = getCart();
  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalGuarani = cart.reduce((acc, item) => acc + (item.price_guarani * item.quantity), 0);
  return { cart, itemCount, totalGuarani };
}

// Actualizar contadores de carrito en la UI
function updateCartBadges() {
  const { itemCount } = getCartTotals();
  document.querySelectorAll('.cart-badge-count').forEach(el => {
    el.textContent = itemCount;
    el.style.display = itemCount > 0 ? 'inline-flex' : 'none';
  });
}

// Mostrar mensaje Toast al agregar
function showCartToast(msg) {
  let toast = document.getElementById('cartToastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cartToastNotification';
    toast.style.cssText = `
      position: fixed;
      bottom: 85px;
      right: 25px;
      background: linear-gradient(135deg, #00d2ff 0%, #0066ff 100%);
      color: #040915;
      padding: 12px 22px;
      border-radius: 30px;
      font-weight: 800;
      font-size: 0.9rem;
      box-shadow: 0 8px 25px rgba(0, 210, 255, 0.4);
      z-index: 9999;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      transform: translateY(15px);
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
  }, 2800);
}

// Renderizar Drawer / Modal del Carrito
function renderCartDrawer() {
  const drawerBody = document.getElementById('cartDrawerBody');
  const drawerTotal = document.getElementById('cartDrawerTotal');
  if (!drawerBody || !drawerTotal) return;

  const { cart, totalGuarani } = getCartTotals();

  if (cart.length === 0) {
    drawerBody.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-dim);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.75rem; opacity: 0.5;">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <p style="font-size: 1rem; font-weight: 600; color: var(--text-muted);">Tu carrito está vacío</p>
        <p style="font-size: 0.85rem; margin-top: 0.25rem;">Explora nuestros productos digitales y agrega tus plantillas o cursos favoritos.</p>
      </div>
    `;
    drawerTotal.textContent = formatGuarani(0);
    return;
  }

  drawerBody.innerHTML = cart.map(item => `
    <div style="display: flex; align-items: center; gap: 0.85rem; padding: 0.85rem 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <img src="${item.image_url}" alt="${item.name}" style="width: 54px; height: 54px; object-fit: cover; border-radius: 8px; background: #020612;" />
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 0.9rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
        <div style="font-size: 0.8rem; color: var(--color-electric-blue); font-weight: 700;">${formatGuarani(item.price_guarani)}</div>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.3rem;">
          <button onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})" style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-weight: bold;">-</button>
          <span style="font-size: 0.85rem; font-weight: 700;">${item.quantity}</span>
          <button onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})" style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-weight: bold;">+</button>
        </div>
      </div>
      <button onclick="removeFromCart(${item.id})" aria-label="Eliminar ítem" style="background: transparent; border: none; color: #ff4d4d; cursor: pointer; padding: 0.3rem;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `).join('');

  drawerTotal.textContent = formatGuarani(totalGuarani);
}

// Inicializar eventos del carrito al cargar
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadges();

  const cartToggleBtn = document.getElementById('cartToggleBtn');
  const cartDrawerOverlay = document.getElementById('cartDrawerOverlay');
  const cartDrawerClose = document.getElementById('cartDrawerClose');

  if (cartToggleBtn && cartDrawerOverlay) {
    cartToggleBtn.addEventListener('click', () => {
      renderCartDrawer();
      cartDrawerOverlay.classList.add('is-open');
    });
  }

  if (cartDrawerClose && cartDrawerOverlay) {
    cartDrawerClose.addEventListener('click', () => {
      cartDrawerOverlay.classList.remove('is-open');
    });
  }

  if (cartDrawerOverlay) {
    cartDrawerOverlay.addEventListener('click', (e) => {
      if (e.target === cartDrawerOverlay) {
        cartDrawerOverlay.classList.remove('is-open');
      }
    });
  }
});
