function validateCustomerInput({ customer_name, customer_email, customer_phone }) {
  if (!customer_name || !customer_email || !customer_phone) return 'Nombre, correo y teléfono son obligatorios.';
  if (customer_name.trim().length < 2 || customer_name.trim().length > 120) return 'El nombre no tiene un formato válido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email.trim())) return 'El correo electrónico no tiene un formato válido.';
  if (customer_phone.trim().length < 6 || customer_phone.trim().length > 30) return 'El teléfono no tiene un formato válido.';
  return null;
}

function validateQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
  return quantity;
}

module.exports = { validateCustomerInput, validateQuantity };
