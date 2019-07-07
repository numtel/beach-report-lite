const http = require('http');
const Template = require('./Template');

// Instantiate outside of server constructor for parser errors on init
const VIEWS = {
  index: new Template('index.html'),
  detail: new Template('detail.html'),
};

class ReqError extends Error {
  constructor(code, msg) {
    super(msg);
    this.httpCode = code;
  }
}

module.exports = class BeachReportServer extends http.Server {
  // @param provider      BeachReportData
  //    Data provider instance
  // @param enforceHttps  Boolean
  //    Redirect to HTTPS is request uses HTTP (i.e. prod env)
  constructor(provider, enforceHttps = false) {
    super(requestListener({
      '/': {
        async GET(req) {
          const query = parseQuery(req.url);
          let lat, range = 20, data;

          if(typeof query.lat === 'string' && typeof query.range === 'string') {
            lat = parseFloat(query.lat);
            range = parseFloat(query.range);

            if(isNaN(lat) || isNaN(range))
              throw new ReqError(400, 'lat and range must be numbers');

            // Convert miles to degrees latitude
            data = await provider.displayGrades(lat, range / 69);
          }
          return VIEWS.index.render({ lat, range, data });
        },
      },
      '/detail/([\\d]+)': {
        async GET(req, urlMatch) {
          const id = parseInt(urlMatch[1], 10);

          // Should never see this error due to the route path regex being digit only
          if(isNaN(id))
            throw new ReqError(400, 'Invalid Location ID');

          const data = await provider.fetch();
          const loc = data.find(loc => loc._source.id === id);
          if(!loc)
            throw new ReqError(404, 'Location not found');

          return VIEWS.detail.render({ data: loc._source });
        }
      },
    }, enforceHttps));
  }
}

// http.Server superclass binds invocations to the server instance
// @param routes        Object<Object<Function>>
//    Primary Keys map to route path regex
//    Second Keys map to HTTP method names (e.g. GET, POST...)
//    Function returns Promise or throws ReqError
// @param enforceHttps  Boolean
//    Redirect to HTTPS is request uses HTTP (i.e. prod env)
function requestListener(routes, enforceHttps) {
  return async function(req, res) {
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
          console.error(error);
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
  }
}

// Adapted from https://stackoverflow.com/a/13419367
function parseQuery(url) {
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

