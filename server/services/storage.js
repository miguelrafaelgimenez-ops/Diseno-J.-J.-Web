const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
  async upload(file) {
    if (!file || !Buffer.isBuffer(file.buffer)) throw new Error('Archivo inválido.');
    const storageKey = `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
    const target = this.resolveKey(storageKey);
    await fs.promises.writeFile(target, file.buffer, { flag: 'wx' });
    return { storage_key: storageKey, filename: path.basename(file.originalname), mime_type: file.mimetype, size: file.size };
  }
  async delete(key) { return fs.promises.unlink(this.resolveKey(key)); }
  async createTemporaryUrl() { throw new Error('URLs temporales requieren un proveedor privado configurado.'); }
}

module.exports = { StorageProvider, PrivateLocalStorageProvider };
