const http = require('http');
const https = require('https');
const Template = require('./Template');

// Instantiate outside of server constructor for parser errors on init
const VIEWS = {
  index: new Template('index.html'),
  detail: new Template('detail.html'),
};

// Data handling helpers
const sortKey = loc => loc._source.northSouthOrder;
const validGrade = grade => typeof grade === 'string'
                         && grade.match(/^[A-F][+-]?$/);

class ReqError extends Error {
  constructor(code, msg) {
    super(msg);
    this.httpCode = code;
  }
}

module.exports = class BeachReportServer extends http.Server {
  constructor(enforceHttps = false) {
    super(requestListener);
    this.enforceHttps = enforceHttps;
    this.dataPromise = null;
    this.routes = {
      '/': { GET: this.index },
      '/detail/([\\d]+)': { GET: this.detail },
    };

    this.load();
  }
  load() {
    this.dataPromise = fetchData();
  }
  async index(req) {
    const query = parseQuery(req.url);
    let lat, range = 20, data;

    if(typeof query.lat === 'string' && typeof query.range === 'string') {
      lat = parseFloat(query.lat);
      range = parseFloat(query.range);
      // Convert miles to degrees latitude
      data = displayGrades(await this.dataPromise, lat, range / 69);
    }
    return VIEWS.index.render({ lat, range, data });
  }
  async detail(req, urlMatch) {
    const data = await this.dataPromise;
    const id = parseInt(urlMatch[1], 10);

    // Should never see this error due to the route path regex being digit only
    if(isNaN(id))
      throw new ReqError(400, 'Invalid Location ID');

    const loc = data.find(loc => loc._source.id === id);
    if(!loc)
      throw new ReqError(404, 'Location not found');

    return VIEWS.detail.render({ data: loc._source });
  }
}

// http.Server superclass binds invocations to the server instance
async function requestListener(req, res) {
  if(this.enforceHttps && req.headers['x-forwarded-proto'] !== 'https') {
    res.writeHead(302, {'location': 'https://' + req.headers.host + req.url});
    res.end();
    return;
  }

  const qsStart = req.url.indexOf('?');
  const urlWithoutQs = qsStart === -1 ? req.url : req.url.substr(0, qsStart);

  const routePaths = Object.keys(this.routes);
  for(let i = 0; i<routePaths.length; i++) {
    const urlMatch = urlWithoutQs.match(new RegExp('^' + routePaths[i] + '$'));
    if(urlMatch === null || !(req.method in this.routes[routePaths[i]])) continue;

    let result;
    try {
      result = await this.routes[routePaths[i]][req.method].call(this, req, urlMatch);
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

async function fetchData() {
  let locations = await fetchJson('https://admin.beachreportcard.org/api/locations/');
  // Remove data points that don't have the proper key
  locations = locations.filter(x => typeof sortKey(x) === 'number');
  // Don't worry, none should have the exact same latitude
  locations.sort((a, b) => sortKey(a) < sortKey(b) ? 1 : -1);
  return locations;
}

function displayGrades(locations, searchLat, searchRange) {
  const out = [];
  for(let i=0; i<locations.length; i++) {
    const locLat = sortKey(locations[i]);
    if(locLat < searchLat - searchRange) {
      // Locations are sorted by latitude and we've passed our range
      break;
    } else if(locLat > searchLat + searchRange) {
      // Range not yet reached
      continue;
    } else if(validGrade(locations[i]._source.dry_grade)
           || validGrade(locations[i]._source.wet_grade)) {
      out.push(Object.assign({}, locations[i]._source, {
        updated_ago: ago(new Date(locations[i]._source.grade_updated)),
      }));
    }
  }
  return out;
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

// Adapted from Node.js http documentation
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const contentType = res.headers['content-type'];

      let error;
      if(res.statusCode !== 200) {
        error = new Error('Request Failed.\n' +
                          'Status Code: ' + res.statusCode);
      } else if (!/^application\/json/.test(contentType)) {
        error = new Error('Invalid content-type.\n' +
                          'Expected application/json but received ' + contentType);
      }
      if (error) {
        reject(error);
        // Consume response data to free up memory
        res.resume();
        return;
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);
          resolve(parsedData);
        } catch (e) {
          reject(e.message);
        }
      });
    }).on('error', (e) => {
      reject(e);
    });
  });
}

// Adapted from s-ago NPM module
function ago(date) {
  const units = [
    { max: 2760000, value: 60000, name: 'minute', prev: 'just now' },
    { max: 72000000, value: 3600000, name: 'hour', prev: 'an hour ago' },
    { max: 518400000, value: 86400000, name: 'day', prev: 'yesterday' },
    { max: 2419200000, value: 604800000, name: 'week', prev: 'last week' },
    { max: 28512000000, value: 2592000000, name: 'month', prev: 'last month' },
    { max: Infinity, value: 31536000000, name: 'year', prev: 'last year' },
  ];

  const diff = Math.abs(Date.now() - date.getTime());
  for (let i = 0; i < units.length; i++) {
    if (diff < units[i].max) {
      const val = Math.round(diff / units[i].value);
      return val <= 1 ? units[i].prev : val + ' ' + units[i].name + 's ago';
    }
  }
}

