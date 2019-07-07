const HTMLServer = require('./HTMLServer');
const Template = require('./Template');

module.exports = class BeachReportServer extends HTMLServer {
  // @param provider       BeachReportData
  //    Data provider instance
  // @param enforceHttps   Boolean
  //    Redirect to HTTPS is request uses HTTP (i.e. prod env)
  // @param TemplateClass  Default: Template
  //    Optionally, specify a different template class (i.e. testing)
  constructor(provider, enforceHttps = false, TemplateClass = Template) {
    // Instantiate outside of route handler for parser errors on init
    const tplIndex = new TemplateClass('views/index.html');
    const tplDetail = new TemplateClass('views/detail.html');

    super({
      '/': {
        async GET(req) {
          const query = HTMLServer.parseQuery(req.url);
          let lat, range = 20, data;

          if(typeof query.lat === 'string' && typeof query.range === 'string') {
            lat = parseFloat(query.lat);
            range = parseFloat(query.range);

            if(isNaN(lat) || isNaN(range))
              throw new HTMLServer.ReqError(400, 'lat and range must be numbers');

            // Convert miles to degrees latitude
            data = await provider.displayGrades(lat, range / 69);
          }
          return tplIndex.render({ lat, range, data });
        },
      },
      '/detail/([\\d]+)': {
        async GET(req, urlMatch) {
          const id = parseInt(urlMatch[1], 10);

          // Should never see this error due to the route path regex being digit only
          if(isNaN(id))
            throw new HTMLServer.ReqError(400, 'Invalid Location ID');

          const data = await provider.fetch();
          const loc = data.find(loc => loc._source.id === id);
          if(!loc)
            throw new HTMLServer.ReqError(404, 'Location not found');

          return tplDetail.render({ data: loc._source });
        }
      },
    }, enforceHttps);
  }
}

