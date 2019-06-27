const BeachReportServer = require('./BeachReportServer');

const app = new BeachReportServer(
  process.env.PORT,
  process.env.ENFORCE_HTTPS,
);

app.on('error', error => console.error(error));
