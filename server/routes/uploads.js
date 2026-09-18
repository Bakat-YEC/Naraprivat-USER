const express = require('express');
const fs = require('fs');
const path = require('path');
const { uid } = require('../db');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const ALLOWED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf']
};
const MAX_BYTES = {
  image: 2 * 1024 * 1024, // 2 MB
  pdf: 3 * 1024 * 1024    // 3 MB
};

function hasMagicBytes(buffer, mimeType) {
  const latin = (a, b) => buffer.toString('latin1', a, b);
  switch (mimeType) {
    case 'image/png':
      return buffer.length >= 4 && latin(0, 4) === '\x89PNG';
    case 'image/jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/webp':
      return buffer.length >= 12 && latin(0, 4) === 'RIFF' && latin(8, 12) === 'WEBP';
    case 'application/pdf':
      return buffer.length >= 4 && latin(0, 4) === '%PDF';
    default:
      return false;
  }
}

const uploadLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Terlalu banyak upload. Coba lagi nanti.'
});

// POST /api/uploads — { filename, mimeType, data (base64 tanpa prefix) }
router.post('/', uploadLimiter, async (req, res) => {
  const { filename = '', mimeType = '', data = '' } = req.body;
  if (!filename || !data) {
    return res.status(400).json({ message: 'File wajib diisi.' });
  }
  if (!ALLOWED[mimeType]) {
    return res.status(415).json({ message: 'Tipe file tidak diizinkan. Gunakan JPG/PNG/WebP atau PDF.' });
  }
  const buffer = Buffer.from(String(data), 'base64');
  const maxSize = mimeType === 'application/pdf' ? MAX_BYTES.pdf : MAX_BYTES.image;
  if (buffer.length === 0 || buffer.length > maxSize) {
    return res.status(413).json({ message: 'Ukuran file terlalu besar atau kosong.' });
  }
  if (!hasMagicBytes(buffer, mimeType)) {
    return res.status(415).json({ message: 'Isi file tidak sesuai dengan tipe yang dipilih.' });
  }
  const ext = ALLOWED[mimeType][0];
  const safeName = uid('f') + ext;
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, safeName), buffer);

  let previewUrl;
  if (mimeType === 'application/pdf') {
    try {
      const previewName = safeName.replace(/\.pdf$/i, '') + '.png';
      await renderPdfPreview(buffer, path.join(UPLOAD_DIR, previewName));
      previewUrl = `/uploads/${previewName}`;
    } catch (err) {
      console.warn('preview render failed:', err.message);
    }
  }

  const payload = { url: `/uploads/${safeName}`, size: buffer.length, mimeType };
  if (previewUrl) payload.previewUrl = previewUrl;
  res.status(201).json(payload);
});

// Render halaman pertama PDF menjadi PNG (untuk preview yang tidak bisa diunduh).
async function renderPdfPreview(pdfBuffer, outPath) {
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
  const page = doc.loadPage(0);
  const pixmap = page.toPixmap(mupdf.Matrix.scale(1.5, 1.5), mupdf.ColorSpace.DeviceRGB, false, true, false);
  fs.writeFileSync(outPath, pixmap.asPNG());
}

module.exports = router;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
