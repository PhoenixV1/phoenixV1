const CACHE_NAME = 'phoenix-v1-cache-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/games.html',
  '/apps.html',
  '/browser.html',
  '/settings.html',
  '/iframe.html',
  '/gameoverlay.html',
  '/home.html',
  '/Phoenix.wav',
  '/assets/themes/theme.json',
  '/sj/scramjet.bundle.js',
  '/bm/worker.js',
  '/lc/index.mjs'
];

if (navigator.userAgent.includes("Firefox")) {
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    value: true,
    writable: false,
  });
}

try {
  importScripts("/sj/scramjet.all.js");
} catch (e) {
  console.warn("Phoenix Shield: Local Scramjet core not detected at /sj/scramjet.all.js");
}

const CONFIG = {
  blocked: [
    "youtube.com/get_video_info?*adformat=*",
    "youtube.com/api/stats/ads/*",
    "youtube.com/pagead/*",
    ".facebook.com/ads/*",
    ".facebook.com/tr/*",
    ".fbcdn.net/ads/*",
    "graph.facebook.com/ads/*",
    "ads-api.twitter.com/*",
    "analytics.twitter.com/*",
    ".twitter.com/i/ads/*",
    ".ads.yahoo.com",
    ".advertising.com",
    ".adtechus.com",
    ".oath.com",
    ".verizonmedia.com",
    ".amazon-adsystem.com",
    "aax.amazon-adsystem.com/*",
    "c.amazon-adsystem.com/*",
    ".adnxs.com",
    ".adnxs-simple.com",
    "ab.adnxs.com/*",
    ".rubiconproject.com",
    ".magnite.com",
    ".pubmatic.com",
    "ads.pubmatic.com/*",
    ".criteo.com",
    "bidder.criteo.com/*",
    "static.criteo.net/*",
    ".openx.net",
    ".openx.com",
    ".indexexchange.com",
    ".casalemedia.com",
    ".adcolony.com",
    ".chartboost.com",
    ".unityads.unity3d.com",
    ".inmobiweb.com",
    ".tapjoy.com",
    ".applovin.com",
    ".vungle.com",
    ".ironsrc.com",
    ".fyber.com",
    ".smaato.net",
    ".supersoniads.com",
    ".startappservice.com",
    ".airpush.com",
    ".outbrain.com",
    ".taboola.com",
    ".revcontent.com",
    ".zedo.com",
    ".mgid.com",
    "*/ads/*",
    "*/adserver/*",
    "*/adclick/*",
    "*/banner_ads/*",
    "*/sponsored/*",
    "*/promotions/*",
    "*/tracking/ads/*",
    "*/promo/*",
    "*/affiliates/*",
    "*/partnerads/*",
  ]
};

let scramjet;
if (typeof $scramjetLoadWorker === 'function') {
  const { ScramjetServiceWorker } = $scramjetLoadWorker();
  scramjet = new ScramjetServiceWorker();
}

function toRegex(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{DOUBLE_STAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{DOUBLE_STAR}}/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function isBlocked(hostname, pathname) {
  return CONFIG.blocked.some((pattern) => {
    if (pattern.startsWith("#") || pattern.startsWith("*")) pattern = pattern.substring(1);
    if (pattern.includes("/")) {
      const [hostPattern, ...pathParts] = pattern.split("/");
      const pathPattern = pathParts.join("/");
      return toRegex(hostPattern).test(hostname) && toRegex(`/${pathPattern}`).test(pathname);
    }
    return toRegex(pattern).test(hostname);
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});

async function handleRequest(event) {
  const url = new URL(event.request.url);

  if (scramjet) {
    await scramjet.loadConfig();
    if (scramjet.route(event)) {
      const response = await scramjet.fetch(event);
      if (response.headers.get("content-type")?.includes("text/html")) {
        const text = await response.text();
        const headers = new Headers(response.headers);
        headers.set("content-length", new TextEncoder().encode(text).length.toString());
        return new Response(text, { status: response.status, statusText: response.statusText, headers });
      }
      return response;
    }
  }

  if (url.origin === self.location.origin) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    const fetched = fetch(event.request).then((res) => {
      if (ASSETS_TO_CACHE.includes(url.pathname)) cache.put(event.request, res.clone());
      return res;
    }).catch(() => {});
    return cached || fetched;
  }

  return fetch(event.request);
}

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes("supabase.co")) return;
  event.respondWith(handleRequest(event));
});

if (scramjet) {
  scramjet.addEventListener("request", (e) => {
    if (isBlocked(e.url.hostname, e.url.pathname)) {
      e.response = new Response("PHOENIX SHIELD: Site Blocked", { status: 403 });
    }
  });
}
