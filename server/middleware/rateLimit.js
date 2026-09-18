function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 30, message = 'Terlalu banyak percobaan. Coba lagi nanti.' } = {}) {
  const hits = new Map();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, list] of hits) {
      const alive = list.filter((t) => now - t < windowMs);
      if (alive.length === 0) hits.delete(ip);
      else hits.set(ip, alive);
    }
  }, windowMs);
  if (timer.unref) timer.unref();

  return (req, res, next) => {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      return res.status(429).json({ message });
    }
    list.push(now);
    hits.set(ip, list);
    next();
  };
}

module.exports = { createRateLimiter };
