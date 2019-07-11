const http = require('http');
const https = require('https');
const url = require('url');

const DATA = Symbol('data');
const LAST_REFRESH = Symbol('last_refresh');

// Data handling helpers
const sortKey = loc => loc._source.northSouthOrder;
const validGrade = grade => typeof grade === 'string'
                         && grade.match(/^[A-F][+-]?$/);

module.exports = class BeachReportData {
  // @param refreshInterval     Integer
  //    Time in milliseconds before data is considered stale and should be reloaded
  //    Pass falsy to never refresh data after initialization
  // @param apiUrl              String
  //    API URL to obtain JSON dataset, defaults to beachreportcard.org
  //    Pass custom value for test server
  constructor(refreshInterval, apiUrl) {
    this.refreshInterval = refreshInterval;
    this.apiUrl = apiUrl || 'https://admin.beachreportcard.org/api/locations/';

    this[LAST_REFRESH] = null;
    this[DATA] = null;
  }
  // Return all data
  async fetch() {
    // Use cached dataset when applicable
    if(this[DATA] !== null
        && this[LAST_REFRESH] !== null
        && (!this.refreshInterval
            || (Date.now() - this[LAST_REFRESH] < this.refreshInterval)))
      return this[DATA];

    // Fetch new dataset from API
    this[LAST_REFRESH] = Date.now();
    return this[DATA] = fetchJson(this.apiUrl, this.rejectUnauthorized).then(locations => {
      // Remove data points that don't have the proper key
      locations = locations.filter(x => typeof sortKey(x) === 'number');
      // Don't worry, none should have the exact same latitude
      locations.sort((a, b) => sortKey(a) < sortKey(b) ? 1 : -1);
      return locations;
    });
  }
  // Query subset of data
  async displayGrades(searchLat, searchRange) {
    const locations = await this.fetch();
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
}

// Adapted from Node.js http documentation
function fetchJson(jsonUrl) {
  return new Promise((resolve, reject) => {
    (url.parse(jsonUrl).protocol === 'https:' ? https : http).get(jsonUrl, (res) => {
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
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
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
