const assert = require('assert');

const BeachReportData = require('../src/BeachReportData');

const MockApiServer = require('./mock/MockApiServer');

function testProvider(refreshInterval, locationCount, handler) {
  return new Promise((resolve, reject) => {
    const apiServer = new MockApiServer(locationCount);
    apiServer.on('error', error => console.error(error));
    apiServer.on('listening', async function() {
      const provider = new BeachReportData(
        refreshInterval,
        'http://localhost:' + apiServer.address().port,
      );
      const opts = {
        fetchCount: 0,
        provider,
      };

      apiServer.on('fetch', () => opts.fetchCount++);

      try {
        await handler(opts);
      } catch(error) {
        reject(error);
      } finally {
        apiServer.close();
      }
      resolve();
    });
    apiServer.listen(0);
  });
}

for(let testCase of [
  function fetchAllCase(willCache, fullCount) {
    return async function(opts) {
      const data = await opts.provider.fetch();
      assert.strictEqual(opts.fetchCount, 1);
      assert.strictEqual(data.length, fullCount);
      const data2 = await opts.provider.fetch();
      assert.strictEqual(opts.fetchCount, willCache ? 1 : 2);
      assert.strictEqual(data2.length, fullCount);
    }
  },
  function displayGradesCase(willCache) {
    return async function(opts) {
      const data = await opts.provider.displayGrades(5, 1);
      assert.strictEqual(opts.fetchCount, 1);
      assert.strictEqual(data.length, 3);
      assert.strictEqual(data[0].northSouthOrder, 6);
      assert.strictEqual(data[1].northSouthOrder, 5);
      assert.strictEqual(data[2].northSouthOrder, 4);
      const data2 = await opts.provider.displayGrades(5, 2);
      assert.strictEqual(opts.fetchCount, willCache ? 1 : 2);
      assert.strictEqual(data2.length, 5);
    }
  },
]) {
  const locationCount = 15;
  // Run test case with and without caching
  testProvider(1, locationCount, testCase(false, locationCount));
  testProvider(false, locationCount, testCase(true, locationCount));
}

