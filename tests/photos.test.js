import { test, expect } from 'vitest';
import { pickPhotos } from '../src/lib/server/photos.js';

const stream = { photos: [{
  photoGuid: 'g1',
  caption: '  Sommerferie ',
  dateCreated: '2025-07-14T10:00:00Z',
  derivatives: {
    '342':  { width: '342',  checksum: 'small' },
    '2049': { width: '2049', checksum: 'big' },
  },
}] };
const assets = { items: {
  small: { url_location: 'cdn.icloud.com', url_path: '/s.jpg?x=1' },
  big:   { url_location: 'cdn.icloud.com', url_path: '/b.jpg?x=1' },
} };

test('picks the largest derivative with caption and taken-at date', () => {
  expect(pickPhotos(stream, assets)).toEqual([{
    url: 'https://cdn.icloud.com/b.jpg?x=1',
    caption: 'Sommerferie',
    takenAt: '2025-07-14T10:00:00Z',
  }]);
});

test('empty caption becomes null', () => {
  const s = { photos: [{ ...stream.photos[0], caption: '' }] };
  expect(pickPhotos(s, assets)[0].caption).toBeNull();
});

test('skips photos whose asset URL is missing', () => {
  expect(pickPhotos(stream, { items: {} })).toEqual([]);
});
