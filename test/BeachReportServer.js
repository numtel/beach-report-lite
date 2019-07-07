const assert = require('assert');
const http = require('http');

const BeachReportServer = require('../src/BeachReportServer');

const MockProvider = require('./mock/MockProvider');
const MockTemplateClass = require('./mock/MockTemplateClass');

function testRoute(url) {
  return new Promise((resolve, reject) => {
    const provider = new MockProvider(15);
    const templater = new MockTemplateClass;
    const app = new BeachReportServer(provider, false, templater.TemplateClass);

    app.on('error', error => reject(error));
    app.on('listening', function() {
      let tplFilename, tplCtx;

      // A template should render before the request returns
      templater.once('render', function(filename, ctx) {
        tplFilename = filename;
        tplCtx = ctx;
      });

      http.get('http://localhost:' + app.address().port + url, (res) => {
        let rawData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            // Mock Template Class sends the filename as the body text
            assert.strictEqual(rawData, tplFilename);
          } catch(error) {
            reject({ res, error, rawData });
          } finally {
            app.close();
          }
          resolve({ res, tplFilename, tplCtx, mockData: provider.data });
        });
      });
    });

    app.listen(0);
  });
}

// Main index page test case
(async function(){
  const result = await testRoute('/');
  assert(result.tplFilename.match(/index/));
  assert.strictEqual(result.tplCtx.lat, undefined);
  // Hard-coded default value
  assert.strictEqual(result.tplCtx.range, 20);
  assert.strictEqual(result.tplCtx.data, undefined);
})();

// Search result page test case
(async function(){
  // Range of 69 miles = 1 degree latitude
  const result = await testRoute('/?lat=5&range=69');
  assert(result.tplFilename.match(/index/));
  assert.strictEqual(result.tplCtx.lat, 5);
  assert.strictEqual(result.tplCtx.range, 69);
  assert.strictEqual(result.tplCtx.data.length, 3);
  assert.strictEqual(result.tplCtx.data[0].northSouthOrder, 6);
  assert.strictEqual(result.tplCtx.data[1].northSouthOrder, 5);
  assert.strictEqual(result.tplCtx.data[2].northSouthOrder, 4);
})();

// Search result error test case
(async function(){
  let result;
  try {
    result = await testRoute('/?lat=5&range=bad');
  } catch(error) {
    assert.strictEqual(error.res.statusCode, 400);
    assert.strictEqual(error.rawData, 'lat and range must be numbers');
  }
  assert(!result, 'Should have thrown')
})();

// Detail page test case
(async function(){
  const result = await testRoute('/detail/9');
  assert(result.tplFilename.match(/detail/));
  assert.strictEqual(JSON.stringify(result.tplCtx.data), JSON.stringify(result.mockData[9]._source));
})();

// Detail page error test case
(async function(){
  let result;
  try {
    result = await testRoute('/detail/1234567');
  } catch(error) {
    assert.strictEqual(error.res.statusCode, 404);
    assert.strictEqual(error.rawData, 'Location not found');
  }
  assert(!result, 'Should have thrown')
})();
