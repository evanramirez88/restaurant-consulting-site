
/**
 * Dashboard & Metrics Caching Utility
 * Handles caching of expensive queries in D1
 */

export async function getCachedData(env, key) {
    try {
        const cache = await env.DB.prepare(`
      SELECT data, expires_at FROM dashboard_metrics_cache
      WHERE cache_key = ? AND expires_at > ?
    `).bind(key, Math.floor(Date.now() / 1000)).first();

        if (cache && cache.data) {
            return JSON.parse(cache.data);
        }
        return null;
    } catch (e) {
        console.error('Cache get error:', e);
        return null;
    }
}

export async function setCachedData(env, key, data, ttlSeconds = 300) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + ttlSeconds;
        const json = JSON.stringify(data);
        const id = `cache_${key}_${now}`; // Unique ID for upsert-like behavior if we cleaned up

        // Upsert logic (delete old then insert new, or replace)
        await env.DB.prepare(`
      DELETE FROM dashboard_metrics_cache WHERE cache_key = ?
    `).bind(key).run();

        await env.DB.prepare(`
      INSERT INTO dashboard_metrics_cache (id, cache_key, data, computed_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, key, json, now, expiresAt).run();

        return true;
    } catch (e) {
        console.error('Cache set error:', e);
        return false;
    }
}

export async function invalidateCache(env, keyPattern) {
    try {
        if (keyPattern.endsWith('%')) {
            await env.DB.prepare(`
        DELETE FROM dashboard_metrics_cache WHERE cache_key LIKE ?
      `).bind(keyPattern).run();
        } else {
            await env.DB.prepare(`
        DELETE FROM dashboard_metrics_cache WHERE cache_key = ?
      `).bind(keyPattern).run();
        }
        return true;
    } catch (e) {
        console.error('Cache invalidation error:', e);
        return false;
    }
}
