const assert = require('assert');
const http = require('http');

const HTMLServer = require('../src/HTMLServer');

const TEST_500_MSG = 'test_500';
const TEST_400_MSG = 'test_400';

function testRoute(url, enforceHttps = false, fakeHttpsRequest = false) {
  return new Promise((resolve, reject) => {
    const errors = [];
    const app = new HTMLServer({
      '/hello/([\\d]+)': {
        async GET(req, urlMatch) {
          switch(urlMatch[1]) {
            case '500':
              throw new Error(TEST_500_MSG);
            case '400':
              throw new HTMLServer.ReqError(400, TEST_400_MSG);
            case '111':
              return JSON.stringify(HTMLServer.parseQuery(req.url));
            default:
              return urlMatch[1];
          }
        }
      }
    }, enforceHttps);
    app.on('error', error => errors.push(error));
    app.on('listening', function() {
      const headers = {};
      if(fakeHttpsRequest) headers['x-forwarded-proto'] = 'https';
      http.get('http://localhost:' + app.address().port + url, { headers }, (res) => {
        let rawData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          app.close();
          resolve({ res, rawData, errors });
        });
      });
    });

    app.listen(0);
  });
}

// Not found test case
(async function() {
  const result = await testRoute('/404');
  assert.strictEqual(result.res.statusCode, 404);
  assert.strictEqual(result.res.headers['content-type'], 'text/plain');
  assert.strictEqual(result.errors.length, 0);
})();

// Internal server error test case
(async function() {
  const result = await testRoute('/hello/500');
  assert.strictEqual(result.res.statusCode, 500);
  assert.strictEqual(result.res.headers['content-type'], 'text/plain');
  assert.strictEqual(result.errors.length, 1);
  assert.strictEqual(result.errors[0].message, TEST_500_MSG);
})();

// HTMLServer.ReqError test case
(async function() {
  const result = await testRoute('/hello/400');
  assert.strictEqual(result.res.statusCode, 400);
  assert.strictEqual(result.res.headers['content-type'], 'text/plain');
  assert.strictEqual(result.rawData, TEST_400_MSG);
  assert.strictEqual(result.errors.length, 0);
})();

// General success
(async function() {
  const result = await testRoute('/hello/1234');
  assert.strictEqual(result.res.statusCode, 200);
  assert.strictEqual(result.res.headers['content-type'], 'text/html');
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.rawData, '1234');
})();

// HTMLServer.parseQuery test case
(async function() {
  const result = await testRoute('/hello/111?horse=cow&cheese=wiz');
  assert.strictEqual(result.res.statusCode, 200);
  // Always returns HTML MIME on success
  assert.strictEqual(result.res.headers['content-type'], 'text/html');
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.rawData, JSON.stringify({ horse: 'cow', cheese: 'wiz' }));
})();

// Server redirects to HTTPS, send standard HTTP request
(async function() {
  const result = await testRoute('/hello/1234', true);
  assert.strictEqual(result.res.statusCode, 302);
  assert(result.res.headers['location'].match(/^https:/));
})();

// Send request with HTTPS forward header, no redirect issued
(async function() {
  const result = await testRoute('/hello/1234', true, true);
  // Do not need to compare everything since it's tested above
  assert.strictEqual(result.rawData, '1234');
})();
