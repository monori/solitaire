// Service Worker for Offline Solitaire Game
const CACHE_NAME = 'solitaire-offline-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/game.js',
    '/styles.css',
    '/readme.md'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: All files cached');
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
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip external requests (ads, analytics, etc.)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version if available
                if (response) {
                    console.log('Service Worker: Serving from cache', event.request.url);
                    return response;
                }
                
                // Otherwise, fetch from network
                console.log('Service Worker: Fetching from network', event.request.url);
                return fetch(event.request).then((response) => {
                    // Don't cache non-successful responses
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response for caching
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                }).catch(() => {
                    // Network failed, show offline message for HTML requests
                    if (event.request.headers.get('accept').includes('text/html')) {
                        return new Response(
                            `<!DOCTYPE html>
                            <html>
                            <head>
                                <title>Offline - Solitaire</title>
                                <style>
                                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #2c8a43; color: white; }
                                    .offline-message { background: rgba(0,0,0,0.3); padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; }
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
                });
            })
    );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
}); 