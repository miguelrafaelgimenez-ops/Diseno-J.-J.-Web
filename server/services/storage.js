const path = require('path');
const fs = require('fs');

class StorageProvider {
  async upload() { throw new Error('StorageProvider.upload aún no está configurado.'); }
  async download() { throw new Error('StorageProvider.download aún no está configurado.'); }
  async delete() { throw new Error('StorageProvider.delete aún no está configurado.'); }
  async createTemporaryUrl() { throw new Error('Almacenamiento privado externo pendiente de configuración.'); }
}

class PrivateLocalStorageProvider extends StorageProvider {
  constructor(rootDir) {
    super();
    this.rootDir = path.resolve(rootDir);
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  resolveKey(key) {
    const resolved = path.resolve(this.rootDir, key);
    if (resolved !== this.rootDir && !resolved.startsWith(`${this.rootDir}${path.sep}`)) {
      const error = new Error('Ruta de almacenamiento no válida.');
      error.code = 'INVALID_STORAGE_KEY';
      throw error;
    }
    return resolved;
  }

  async download(key) { return this.resolveKey(key); }
  async upload() { throw new Error('La carga de archivos requiere un proveedor privado configurado.'); }
  async delete(key) { return fs.promises.unlink(this.resolveKey(key)); }
  async createTemporaryUrl() { throw new Error('URLs temporales requieren un proveedor privado configurado.'); }
}

module.exports = { StorageProvider, PrivateLocalStorageProvider };
