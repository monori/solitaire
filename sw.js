// Service Worker for Offline Solitaire Game
const CACHE_VERSION = Date.now(); // Use timestamp for versioning
const CACHE_NAME = `solitaire-offline-v${CACHE_VERSION}`;
const STATIC_CACHE = `solitaire-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `solitaire-dynamic-v${CACHE_VERSION}`;

// Critical files that should always be cached
const CRITICAL_FILES = [
    '/',
    '/index.html',
    '/da/index.html',
    '/game.js',
    '/styles.css'
];

// Install event - cache critical resources
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing with cache version', CACHE_VERSION);
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Service Worker: Caching critical files');
                return cache.addAll(CRITICAL_FILES);
            })
            .then(() => {
                console.log('Service Worker: Critical files cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Cache failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete any cache that doesn't match current version
                    if (cacheName.startsWith('solitaire-') && 
                        !cacheName.includes(`v${CACHE_VERSION}`)) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activated with new cache version');
            return self.clients.claim();
        })
    );
});

// Network first strategy for main files, cache fallback for offline
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip external requests (ads, analytics, etc.)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    // For critical files, use network-first strategy
    const url = new URL(event.request.url);
    const isCriticalFile = CRITICAL_FILES.some(file => 
        url.pathname === file || url.pathname === file.replace(/\/$/, '/index.html')
    );
    
    if (isCriticalFile) {
        event.respondWith(networkFirstStrategy(event.request));
    } else {
        event.respondWith(cacheFirstStrategy(event.request));
    }
});

// Network-first strategy: Try network first, fallback to cache
async function networkFirstStrategy(request) {
    try {
        console.log('Service Worker: Network-first for', request.url);
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            // Cache the fresh response
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache for', request.url);
    }
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Both failed, return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
        return getOfflineResponse();
    }
    
    throw new Error('No network or cache available');
}

// Cache-first strategy: Check cache first, then network
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        console.log('Service Worker: Serving from cache', request.url);
        return cachedResponse;
    }
    
    try {
        console.log('Service Worker: Fetching from network', request.url);
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            // Cache the response
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed
        if (request.headers.get('accept').includes('text/html')) {
            return getOfflineResponse();
        }
        throw error;
    }
}

// Generate offline response
function getOfflineResponse() {
    return new Response(
        `<!DOCTYPE html>
        <html>
        <head>
            <title>Offline - Solitaire</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #2c8a43; color: white; }
                .offline-message { background: rgba(0,0,0,0.3); padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; }
                button { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; }
                button:hover { background: #45a049; }
            </style>
        </head>
        <body>
            <div class="offline-message">
                <h1>🃏 Offline Mode</h1>
                <p>You're currently offline, but you can still play Solitaire!</p>
                <p>Your game progress is saved locally and will sync when you're back online.</p>
                <button onclick="window.location.reload()">Try Again</button>
            </div>
        </body>
        </html>`,
        {
            headers: {
                'Content-Type': 'text/html'
            }
        }
    );
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
}); 