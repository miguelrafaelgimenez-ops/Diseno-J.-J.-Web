// Compatibilidad para módulos antiguos. La capa de datos activa es sqlite.js.
// Mantener este punto de entrada evita romper imports externos mientras se
// completa la migración del proyecto.
module.exports = require('./sqlite');
