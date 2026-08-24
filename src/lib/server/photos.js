async function apiPost(host, token, path, body, hops = 0) {
  const res = await fetch(`https://${host}/${token}/sharedstreams/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 330 && data['X-Apple-MMe-Host']) {
    if (hops >= 3) throw new Error(`icloud ${path} -> too many 330 redirects`);
    return apiPost(data['X-Apple-MMe-Host'], token, path, body, hops + 1);
  }
  if (!res.ok) throw new Error(`icloud ${path} -> ${res.status}`);
  return data;
}

export function pickPhotos(stream, assets) {
  return (stream.photos ?? [])
    .map((p) => {
      const best = Object.values(p.derivatives ?? {})
        .sort((a, b) => Number(b.width) - Number(a.width))[0];
      const item = best && assets.items?.[best.checksum];
      return item && {
        url: `https://${item.url_location}${item.url_path}`,
        caption: p.caption?.trim() || null,
        takenAt: p.dateCreated ?? null,
      };
    })
    .filter(Boolean);
}

export async function fetchAlbum(token) {
  if (!token) return { photos: [] };
  const stream = await apiPost('p23-sharedstreams.icloud.com', token, 'webstream', { streamCtag: null });
  const guids = (stream.photos ?? []).map((p) => p.photoGuid);
  const assets = await apiPost('p23-sharedstreams.icloud.com', token, 'webasseturls', { photoGuids: guids });
  return { photos: pickPhotos(stream, assets) };
}
