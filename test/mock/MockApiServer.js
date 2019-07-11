const http = require('http');

const MockProvider = require('./MockProvider');

module.exports = class MockApiServer extends http.Server {
  constructor(locationCount) {
    const provider = new MockProvider(locationCount);
    super(function(req, res) {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(provider.data));
      this.emit('fetch');
    });
  }
}
