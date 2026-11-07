// @ts-check
/**
 * The service worker of the page installed as an app: what the page loads is kept, so that it opens with
 * no network (a call still needs one). The page's own files are fetched first, so that a new version is
 * seen as soon as it is published, and taken from what was kept only when the network fails. Trystero,
 * pinned, is taken from what was kept first.
 */

/** @type {any} the worker's global scope: the DOM's types, which this project is checked against, lack it */
const worker = self;

const CACHE = 'telefonos';

/** Where Trystero and what it imports come from, each at a pinned version: what is kept never changes. */
const CDN = 'https://cdn.jsdelivr.net/npm/';

worker.addEventListener('install', () => worker.skipWaiting());
worker.addEventListener('activate', (/** @type {any} */ e) => e.waitUntil(worker.clients.claim()));

worker.addEventListener('fetch', (/** @type {any} */ e) => {
  /** @type {Request} */
  const request = e.request;
  if (request.method !== 'GET')
    return;
  if (request.url.startsWith(CDN))
    e.respondWith(keptFirst(request, e));
  else if (request.url.startsWith(worker.location.origin + '/'))
    e.respondWith(networkFirst(request, e));
});

/**
 * @param {Request} request
 * @param {any} e the fetch event, which lives until the response is kept
 * @returns {Promise<Response>}
 */
async function networkFirst(request, e) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok)
      e.waitUntil(cache.put(request, response.clone()));
    return response;
  }
  catch (error) {
    // the page asked for with a query is the page
    const hit = await cache.match(request, {ignoreSearch: request.mode === 'navigate'});
    if (hit)
      return hit;
    throw error;
  }
}

/**
 * @param {Request} request
 * @param {any} e
 * @returns {Promise<Response>}
 */
async function keptFirst(request, e) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit)
    return hit;
  const response = await fetch(request);
  if (response.ok)
    e.waitUntil(cache.put(request, response.clone()));
  return response;
}
