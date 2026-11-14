const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const sitemap = require('../../api/sitemap.js');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function value(input) {
  if (typeof input === 'boolean') return { booleanValue: input };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  if (input && typeof input === 'object') return { mapValue: { fields: fields(input) } };
  return { stringValue: String(input) };
}
function fields(input) { return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)])); }
const doc = input => ({ fields: fields(input) });

function mockFirestore({ failVideo = false } = {}) {
  global.fetch = async input => {
    const url = new URL(input);
    let data;
    if (url.hostname === 'www.youtube.com') {
      if (failVideo) throw new Error('Video unavailable');
      data = { title: 'A journey & history', thumbnail_url: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' };
    } else if (url.pathname.endsWith('/posts')) {
      data = { documents: [
        doc({ slug: 'published', status: 'published', excerpt: 'A real description', featuredImage: '/photo.jpg', contentImages: ['/photo.jpg'], content: '<img src="https://cdn.example.com/photo.jpg?a=1&amp;b=2"><iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><iframe src="https://evil.example.com/embed/abcdefghijk"></iframe>', updatedAt: '2026-11-14T10:00:00Z' }),
        doc({ slug: 'draft', status: 'draft', featuredImage: '/private.jpg' })
      ] };
    } else if (url.pathname.endsWith('/trips')) {
      data = url.searchParams.has('pageToken') ? { documents: [doc({ slug: 'international', status: 'active', scope: 'internacional', mainImage: '/trip.jpg' })] } : {
        documents: [doc({ slug: 'national', status: 'active', scope: 'nacional', gallery: ['/gallery.jpg'] }), doc({ slug: 'inactive', status: 'inactive' })], nextPageToken: 'next'
      };
    } else if (url.pathname.endsWith('/banners')) {
      data = { documents: [doc({ status: 'active', imageUrl: '/banner.jpg', imageUrlMobile: '/mobile.jpg' }), doc({ status: 'inactive', imageUrl: '/old.jpg' })] };
    } else if (url.pathname.endsWith('/header')) {
      data = doc({ links: [{ visible: true, route: '/viagens/cultural' }, { visible: false, route: '/viagens/hidden' }] });
    } else if (url.pathname.endsWith('/about')) {
      data = doc({ home: { imageUrl: '/home-about.jpg' }, about: { storyImageUrl: '/story.jpg' } });
    } else throw new Error(`Unexpected request: ${url}`);
    return { ok: true, json: async () => data };
  };
}

test('includes canonical published pages, follows pagination and excludes drafts and hidden menus', async () => {
  mockFirestore();
  const entries = await sitemap.buildEntries();
  const paths = entries.map(entry => entry.path);
  for (const path of ['/roteiros-nacionais/national/', '/roteiros-internacionais/international/', '/blog/published/', '/viagens/cultural/']) assert.ok(paths.includes(path));
  assert.ok(!paths.some(path => /draft|inactive|hidden|admin/.test(path)));
  assert.equal(entries.find(entry => entry.path === '/blog/published/').lastmod, '2026-11-14');
});

test('associates images and real video metadata with their page and escapes XML', async () => {
  mockFirestore();
  const entries = await sitemap.buildEntries();
  const post = entries.find(entry => entry.path === '/blog/published/');
  assert.equal(post.images.filter(url => url.endsWith('/photo.jpg')).length, 1);
  assert.equal(post.videos.length, 1);
  assert.equal(post.videos[0].title, 'A journey & history');
  const xml = sitemap.renderXml(entries);
  assert.ok(xml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'));
  assert.ok(xml.includes('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"'));
  assert.ok(xml.includes('a=1&amp;b=2'));
  assert.ok(xml.includes('<video:title>A journey &amp; history</video:title>'));
  assert.ok(!xml.includes('evil.example.com'));
  const home = entries.find(entry => entry.path === '/');
  assert.ok(home.images.includes('https://www.unitur.com.br/mobile.jpg'));
  assert.ok(!home.images.some(image => image.includes('old.jpg')));
});

test('omits unavailable video metadata without losing its page or images', async () => {
  mockFirestore({ failVideo: true });
  const entries = await sitemap.buildEntries();
  const post = entries.find(entry => entry.path === '/blog/published/');
  assert.ok(post.images.length > 0);
  assert.ok(!post.videos?.length);
});

test('rejects non-HTTP images and deduplicates pages', () => {
  const xml = sitemap.renderXml([
    { path: '/test/', images: ['javascript:alert(1)', 'data:image/png;base64,x', '/ok.jpg', '/ok.jpg'] },
    { path: '/test/' }
  ]);
  assert.equal((xml.match(/<url>/g) || []).length, 1);
  assert.equal((xml.match(/<image:image>/g) || []).length, 1);
  assert.ok(!xml.includes('javascript:'));
});

test('serves a cacheable UTF-8 XML response', async () => {
  mockFirestore();
  const headers = {};
  let body;
  const response = { setHeader: (key, val) => { headers[key] = val; }, end: val => { body = val; } };
  await sitemap({}, response);
  assert.equal(response.statusCode, 200);
  assert.equal(headers['Content-Type'], 'application/xml; charset=utf-8');
  assert.ok(headers['Cache-Control'].includes('s-maxage=3600'));
  assert.ok(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
});
