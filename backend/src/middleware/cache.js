const cache = new Map();

function ttlCache(ttlMs = 10_000) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const userKey = req.user ? `${req.user.userId}:${req.user.role}` : 'public';
    const key = `${userKey}:${req.originalUrl}`;
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      res.setHeader('X-LearnVault-Cache', 'HIT');
      return res.status(hit.status).json(hit.body);
    }
    const originalJson = res.json.bind(res);
    res.json = body => {
      cache.set(key, { expiresAt: Date.now() + ttlMs, status: res.statusCode, body });
      if (cache.size > 1000) cache.delete(cache.keys().next().value);
      res.setHeader('X-LearnVault-Cache', 'MISS');
      return originalJson(body);
    };
    next();
  };
}

module.exports = ttlCache;
