const buckets = new Map();

function rateLimit({ windowMs = 60_000, max = 120, keyGenerator } = {}) {
  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : `${req.ip}:${req.path}`;
    const now = Date.now();
    let item = buckets.get(key);
    if (!item || now - item.start >= windowMs) {
      item = { start: now, count: 0 };
      buckets.set(key, item);
    }
    item.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - item.count)));
    if (item.count > max) {
      const retryAfter = Math.max(1, Math.ceil((item.start + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again shortly.' });
    }
    next();
  };
}

setInterval(() => {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [key, value] of buckets) if (value.start < cutoff) buckets.delete(key);
}, 5 * 60_000).unref();

module.exports = rateLimit;
