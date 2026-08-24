// TTL cache that never lets an upstream failure take the screen down:
// serves the last good value when the refresh throws.
export function cached(ttlMs, fn) {
  let value, at = 0, inflight;
  const get = async () => {
    if (value !== undefined && Date.now() - at < ttlMs) return value;
    inflight ??= fn()
      .then((v) => { value = v; at = Date.now(); return v; })
      .catch((e) => {
        if (value !== undefined) { at = Date.now(); return value; } // stale
        throw e;
      })
      .finally(() => { inflight = undefined; });
    return inflight;
  };
  get.expire = () => { at = 0; };
  return get;
}
