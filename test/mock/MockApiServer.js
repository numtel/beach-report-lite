const https = require('https');
const fs = require('fs');

const MockProvider = require('./MockProvider');

module.exports = class MockApiServer extends https.Server {
  constructor(locationCount) {
    const provider = new MockProvider(locationCount);
    super({
      // Certificate does not validate but is required to serve https
      // Generated using shell command:
      // openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem
      key: fs.readFileSync('test/ssl/key.pem'),
      cert: fs.readFileSync('test/ssl/cert.pem'),
    }, function(req, res) {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(provider.data));
      this.emit('fetch');
    });
  }
}
