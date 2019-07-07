const BeachReportServer = require('./BeachReportServer');
const BeachReportData = require('./BeachReportData');

const app = new BeachReportServer(
  // Refresh data every 3 hours or specified duration
  new BeachReportData(process.env.REFRESH_INTERVAL || 3*60*60*1000),
  process.env.ENFORCE_HTTPS,
);

app.on('error', error => console.error(error));

app.listen(process.env.PORT || 3000);
