const EventEmitter = require('events');
const request = require('request-promise-native');
const express = require('express');
const ejs = require('ejs');
const ago = require('s-ago').default;

const sortKey = loc => loc._source.northSouthOrder;
const validGrade = grade => typeof grade === 'string'
                         && grade.match(/^[A-F][+-]?$/);

async function fetchRawReport() {
  let locations = await request('https://admin.beachreportcard.org/api/locations/', {
    json: true,
  });
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

class BeachReportServer extends EventEmitter {
  constructor(port = 3000) {
    super();

    const app = this.server = express();
    app.use(express.urlencoded({ extended: true }));
    app.engine('html', ejs.renderFile);
    app.set('view engine', 'html');
    app.set('views', __dirname);

    this.dataPromise = fetchRawReport();

    app.listen(port, error => error && this.emit('error', error));

    app.get('/', (req, res) => {
      res.render('form');
    });

    app.post('/', async function(req, res) {
      if(!req.body.lat || !req.body.range) {
        res.status(400).send('lat_and_range_required');
        return;
      }

      const lat = parseFloat(req.body.lat);
      // Convert miles to degrees latitude
      const range = parseFloat(req.body.range) / 69;

      const slice = displayGrades(await this.dataPromise, lat, range);
      res.render('output', { data: slice });
    }.bind(this));

    app.get('/detail/:id', async function(req, res) {
      const data = await this.dataPromise;
      const id = parseInt(req.params.id, 10);
      if(isNaN(id)) {
        res.status(400).send('invalid_location_id');
        return;
      }
      const loc = data.find(loc => loc._source.id === id);
      if(!loc) {
        res.status(404).send('location_not_found');
        return;
      }

      res.render('detail', { data: loc._source });
    }.bind(this));
  }
}

module.exports = BeachReportServer;