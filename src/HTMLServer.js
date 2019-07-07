const http = require('http');

// Minimal replacement for Express.js

module.exports = class HTMLServer extends http.Server {
  // @param routes        Object<Object<Function>>
  //    Primary Keys map to route path regex
  //    Second Keys map to HTTP method names (e.g. GET, POST...)
  //    Function returns Promise or throws ReqError
  // @param enforceHttps  Boolean
  //    Redirect to HTTPS is request uses HTTP (i.e. prod env)
  constructor(routes, enforceHttps = false) {
    super(async function(req, res) {
      if(enforceHttps && req.headers['x-forwarded-proto'] !== 'https') {
        res.writeHead(302, {'location': 'https://' + req.headers.host + req.url});
        res.end();
        return;
      }

      const qsStart = req.url.indexOf('?');
      const urlWithoutQs = qsStart === -1 ? req.url : req.url.substr(0, qsStart);

      const routePaths = Object.keys(routes);
      for(let i = 0; i<routePaths.length; i++) {
        const urlMatch = urlWithoutQs.match(new RegExp('^' + routePaths[i] + '$'));
        if(urlMatch === null || !(req.method in routes[routePaths[i]])) continue;

        let result;
        try {
          result = await routes[routePaths[i]][req.method].call(this, req, urlMatch);
        } catch(error) {
          if(error instanceof ReqError) {
            res.writeHead(error.httpCode, {'Content-Type': 'text/plain'});
            res.end(error.message);
          } else {
            this.emit('error', error);
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('Internal Server Error');
          }
          return;
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(result);
        return;
      }
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not Found');
    });
  }
}

// Adapted from https://stackoverflow.com/a/13419367
module.exports.parseQuery = function parseQuery(url) {
  const query = {};

  const qsStart = url.indexOf('?');
  if(qsStart === -1)
    return query;
  const queryString = url.substr(qsStart + 1);

  const pairs = queryString.split('&');
  for(let i = 0; i < pairs.length; i++) {
    let pair = pairs[i].split('=', 2);
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return query;
}

class ReqError extends Error {
  constructor(code, msg) {
    super(msg);
    this.httpCode = code;
  }
}
module.exports.ReqError = ReqError;
