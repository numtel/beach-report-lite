const BeachReportServer = require('./BeachReportServer');

const app = new BeachReportServer(
  process.env.PORT,
  process.env.ENFORCE_HTTPS,
);

app.on('error', error => console.error(error));

// Refresh data every 3 hours
const refreshInterval = process.env.REFRESH_INTERVAL || 3*60*60*1000;
setInterval(() => app.fetchData(), refreshInterval);
