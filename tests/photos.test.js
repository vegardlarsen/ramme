import { test, expect } from 'vitest';
import { pickUrls } from '../src/lib/server/photos.js';

const stream = { photos: [{
  photoGuid: 'g1',
  derivatives: {
    '342':  { width: '342',  checksum: 'small' },
    '2049': { width: '2049', checksum: 'big' },
  },
}] };
const assets = { items: {
  small: { url_location: 'cdn.icloud.com', url_path: '/s.jpg?x=1' },
  big:   { url_location: 'cdn.icloud.com', url_path: '/b.jpg?x=1' },
} };

test('picks the largest derivative and builds a full URL', () => {
  expect(pickUrls(stream, assets)).toEqual(['https://cdn.icloud.com/b.jpg?x=1']);
});

test('skips photos whose asset URL is missing', () => {
  expect(pickUrls(stream, { items: {} })).toEqual([]);
});
