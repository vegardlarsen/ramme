import { test, expect } from 'vitest';
import { cached } from '../src/lib/server/cache.js';

test('caches within ttl and serves stale on error', async () => {
  let n = 0;
  const get = cached(10_000, async () => {
    n++;
    if (n === 2) throw new Error('upstream down');
    return n;
  });
  expect(await get()).toBe(1);
  expect(await get()).toBe(1);       // cached, fn not called again
  get.expire();                      // test hook: force refetch
  expect(await get()).toBe(1);       // fn threw -> stale value served
  get.expire();
  expect(await get()).toBe(3);       // recovered
});
