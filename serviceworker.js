var version = 'v2.2.11';

self.addEventListener('install', function(event) {
  console.log('WORKER: install event in progress.');
  event.waitUntil(
    caches.open(version + 'fundamentals').then(function(cache) {
      return cache.addAll([
        '/',
        '/js/require.js',
        '/js/app.js',
        '/css/style.css',
        '/css/fonts/Material+Icons_400_normal.svg',
        '/css/fonts/Material+Icons_400_normal.ttf',
        '/css/fonts/Material+Icons_400_normal.woff',
        '/css/fonts/Roboto_400_normal.svg',
        '/css/fonts/Roboto_400_normal.ttf',
        '/css/fonts/Roboto_400_normal.woff',
        '/css/fonts/Roboto_500_normal.ttf',
        '/css/fonts/Roboto_500_normal.woff',
        '/css/fonts/Roboto_700_normal.ttf',
        '/css/fonts/Roboto_700_normal.woff',
        '/css/fonts/Source+Code+Pro_300_normal.ttf',
        '/css/fonts/Source+Code+Pro_300_normal.woff',
        '/css/fonts/Source+Code+Pro_400_normal.svg',
        '/css/fonts/Source+Code+Pro_400_normal.ttf',
        '/css/fonts/Source+Code+Pro_400_normal.woff',
        '/css/fonts/Source+Code+Pro_600_normal.ttf',
        '/css/fonts/Source+Code+Pro_600_normal.woff',
        '/css/fonts/Source+Code+Pro_700_normal.ttf',
        '/css/fonts/Source+Code+Pro_700_normal.woff'
      ]);
    }).then(function() {
      console.log('WORKER: install completed');
    })
  );
});

self.addEventListener('fetch', function(event) {
  console.log('WORKER: fetch event in progress.');

  if (event.request.method !== 'GET') {
    console.log('WORKER: fetch event ignored.', event.request.method, event.request.url);
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var networked = fetch(event.request)
        .then(fetchedFromNetwork, unableToResolve)
        .catch(unableToResolve);

      console.log('WORKER: fetch event', cached ? '(cached)' : '(network)', event.request.url);

      return cached || networked;

      function fetchedFromNetwork(response) {
        var cacheCopy = response.clone();

        console.log('WORKER: fetch response from network.', event.request.url);

        caches
          .open(version + 'pages')
          .then(function add(cache) {
            cache.put(event.request, cacheCopy);
          })
          .then(function() {
            console.log('WORKER: fetch response stored in cache.', event.request.url);
          });

        return response;
      }

      function unableToResolve () {
        console.log('WORKER: fetch request failed in both cache and network.');

        return new Response('<h1>Service Unavailable</h1>', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/html'
          })
        });
      }
    })
  );
});

self.addEventListener('activate', function(event) {
  console.log('WORKER: activate event in progress.');
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return !key.startsWith(version);
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      console.log('WORKER: activate completed.');
    })
  );
});
