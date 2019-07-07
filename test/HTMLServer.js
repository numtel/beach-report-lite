const assert = require('assert');
const http = require('http');

const HTMLServer = require('../src/HTMLServer');

const TEST_500_MSG = 'test_500';

function testRoute(url, enforceHttps = false, fakeHttpsRequest = false) {
  return new Promise((resolve, reject) => {
    const errors = [];
    const app = new HTMLServer({
      '/hello/([\\d]+)': {
        async GET(req, urlMatch) {
          switch(urlMatch[1]) {
            case '500':
              throw new Error(TEST_500_MSG);
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

(async function() {
  const result = await testRoute('/404');
  assert.strictEqual(result.res.statusCode, 404);
  assert.strictEqual(result.res.headers['content-type'], 'text/plain');
  assert.strictEqual(result.errors.length, 0);
})();

(async function() {
  const result = await testRoute('/hello/500');
  assert.strictEqual(result.res.statusCode, 500);
  assert.strictEqual(result.res.headers['content-type'], 'text/plain');
  assert.strictEqual(result.errors.length, 1);
  assert.strictEqual(result.errors[0].message, TEST_500_MSG);
})();

(async function() {
  const result = await testRoute('/hello/1234');
  assert.strictEqual(result.res.statusCode, 200);
  assert.strictEqual(result.res.headers['content-type'], 'text/html');
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.rawData, '1234');
})();

// Server redirects to HTTPS, send standard HTTP request
(async function() {
  const result = await testRoute('/hello/1234', true);
  assert.strictEqual(result.res.statusCode, 302);
  assert(result.res.headers['location'].match(/^https:/));
})();

// Server redirects to HTTPS, send request with HTTPS forward header
(async function() {
  const result = await testRoute('/hello/1234', true, true);
  // Do not need to compare everything since it's tested above
  assert.strictEqual(result.rawData, '1234');
})();
