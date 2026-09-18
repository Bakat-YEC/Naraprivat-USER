const express = require('express');
const { readDb } = require('../db');

const router = express.Router();

const COUPON_DISCOUNT = 10000;

// GET /api/affiliates/validate?code=X — validasi kupon saat checkout
router.get('/validate', (req, res) => {
  const { code } = req.query;
  if (!code) return res.json({ valid: false, message: 'Masukkan kode kupon.' });
  const db = readDb();
  const aff = db.affiliates.find(
    (a) => a.couponCode.toLowerCase() === String(code).trim().toLowerCase()
  );
  if (!aff) {
    return res.json({ valid: false, message: 'Kode kupon tidak valid.' });
  }
  res.json({ valid: true, discount: COUPON_DISCOUNT, affiliate: { id: aff.id, name: aff.name, couponCode: aff.couponCode, commissionPct: aff.commissionPct } });
});

// GET /api/affiliates/lookup?code=X — dashboard affiliate (demo: pakai kode kupon)
router.get('/lookup', (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ message: 'Masukkan kode kupon.' });
  const db = readDb();
  const aff = db.affiliates.find(
    (a) => a.couponCode.toLowerCase() === String(code).trim().toLowerCase()
  );
  if (!aff) return res.status(404).json({ message: 'Kode kupon tidak ditemukan.' });
  const sales = db.transactions
    .filter((t) => t.affiliateId === aff.id && t.paymentStatus === 'success')
    .map((t) => {
      const tutor = db.users.find((u) => u.id === t.tutorId);
      return {
        id: t.id,
        type: t.type,
        amount: t.amount,
        commission: Math.round((t.amount * aff.commissionPct) / 100),
        tutorName: tutor ? tutor.name : '-',
        createdAt: t.paidAt || t.createdAt
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalCommission = sales.reduce((s, x) => s + x.commission, 0);
  res.json({
    affiliate: { id: aff.id, name: aff.name, couponCode: aff.couponCode, commissionPct: aff.commissionPct },
    totalSales: sales.length,
    totalCommission,
    sales
  });
});

module.exports = router;
