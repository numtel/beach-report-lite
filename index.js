const BeachReportServer = require('./BeachReportServer');

const app = new BeachReportServer(
  process.env.PORT,
);

app.on('error', error => console.error(error));
