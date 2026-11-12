(() => {
/**
 * template-storage.js — File template .docx di Supabase Storage
 * Metadata template + cadangan fileData tetap di sppd_user_store / localStorage.
 */

const TemplateStorage = {
  BUCKET: 'sppd-templates',

  BUNDLED_BY_JENIS: {
    nota_dinas: 'templates/nota_dinas_template.docx',
  },

  canUse() {
    return typeof DB !== 'undefined' && DB.usesCloud() && typeof Auth !== 'undefined' && Auth.client();
  },

  _userId() {
    return DB._userId;
  },

  buildPath(templateId, fileName) {
    const uid = this._userId();
    if (!uid) throw new Error('User belum login');
    const safe = (fileName || 'template.docx').replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${uid}/${templateId}/${safe}`;
  },

  _sb() {
    const sb = Auth.client();
    if (!sb) throw new Error('Supabase tidak tersedia');
    return sb;
  },

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  },

  base64ToBlob(b64) {
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  },

  getFileData(template) {
    return template?.fileData || template?.file_data || template?.base64 || template?.data || '';
  },

  getStoragePath(template) {
    return template?.storagePath || template?.storage_path || template?.path || '';
  },

  getBundledUrl(template) {
    if (template?.jenis && this.BUNDLED_BY_JENIS[template.jenis]) {
      return this.BUNDLED_BY_JENIS[template.jenis];
    }
    return '';
  },

  hasFile(template) {
    return !!(this.getStoragePath(template) || this.getFileData(template) || this.getBundledUrl(template));
  },

  async _fetchBundledBase64(template) {
    if (typeof fetch !== 'function') return '';
    const candidates = [];
    if (template?.fileName) {
      candidates.push(`templates/${encodeURIComponent(template.fileName)}`);
    }
    const byJenis = this.getBundledUrl(template);
    if (byJenis) candidates.push(byJenis);

    for (const url of [...new Set(candidates)]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        // Validasi header ZIP/DOCX (PK\x03\x04)
        if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
          return this.arrayBufferToBase64(buf);
        }
      } catch {
        // Coba kandidat berikutnya
      }
    }
    return '';
  },

  _cacheFileData(template, b64) {
    if (!template || !b64) return;
    template.fileData = b64;
    if (typeof DB !== 'undefined' && typeof KEYS !== 'undefined' && KEYS.templates) {
      const list = DB.getArr(KEYS.templates);
      const idx = list.findIndex((t) => t.id === template.id);
      if (idx >= 0 && !list[idx].fileData) {
        list[idx] = { ...list[idx], fileData: b64 };
        DB.set(KEYS.templates, list);
      }
    }
  },

  /** Upload file; kembalikan storagePath */
  async upload(file, templateId) {
    const path = this.buildPath(templateId, file.name);
    let { error } = await this._sb().storage.from(this.BUCKET).upload(path, file, {
      upsert: true,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    if (error && typeof Auth !== 'undefined' && typeof Auth.isJwtExpired === 'function' && Auth.isJwtExpired(error)) {
      const refreshed = await Auth.refreshSession();
      if (refreshed) {
        ({ error } = await this._sb().storage.from(this.BUCKET).upload(path, file, {
          upsert: true,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }));
      }
    }
    if (error) throw error;
    return path;
  },

  async downloadBase64(template) {
    const fileData = this.getFileData(template);
    if (fileData) return fileData;

    const storagePath = this.getStoragePath(template);
    let storageErr = null;

    if (storagePath && this.canUse()) {
      let { data, error } = await this._sb().storage
        .from(this.BUCKET)
        .download(storagePath);

      if (error && typeof Auth !== 'undefined' && typeof Auth.isJwtExpired === 'function' && Auth.isJwtExpired(error)) {
        const refreshed = await Auth.refreshSession();
        if (refreshed) {
          ({ data, error } = await this._sb().storage
            .from(this.BUCKET)
            .download(storagePath));
        }
      }

      if (!error && data) {
        const buffer = await data.arrayBuffer();
        const b64 = this.arrayBufferToBase64(buffer);
        this._cacheFileData(template, b64);
        return b64;
      }
      storageErr = error;
    }

    // Fallback ke file template bawaan repo bila bucket/storage belum tersedia
    const bundled = await this._fetchBundledBase64(template);
    if (bundled) {
      this._cacheFileData(template, bundled);
      return bundled;
    }

    if (storageErr) throw storageErr;
    throw new Error('File template tidak ditemukan');
  },

  async remove(template) {
    if (!template?.storagePath || !this.canUse()) return;
    const { error } = await this._sb().storage.from(this.BUCKET).remove([template.storagePath]);
    if (error) throw error;
  },

  /** Pertahankan fileData sebagai cadangan agar tidak gagal jika bucket belum siap */
  metaFromRecord(rec, storagePath, fileSize) {
    return {
      ...rec,
      storagePath,
      fileSize: fileSize ?? rec.fileSize ?? null,
    };
  },

  /** Pastikan semua template siap dipakai tanpa menghapus cadangan fileData */
  async migrateTemplatesList(templates) {
    if (!Array.isArray(templates)) return templates;
    return templates;
  },
};

// ___ PUBLIC API (sengaja global; sisanya privat file ini) ___
Object.assign(globalThis, { TemplateStorage });
})();
