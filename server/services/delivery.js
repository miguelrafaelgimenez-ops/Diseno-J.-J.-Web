const db = require('../database/sqlite');

function createDigitalDelivery(orderId) {
  return db.createDigitalDeliveries(orderId);
}

function grantCourseAccess(orderId) {
  return db.grantCourseAccess(orderId);
}

module.exports = { createDigitalDelivery, grantCourseAccess };
