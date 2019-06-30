const BeachReportServer = require('./BeachReportServer');

const app = new BeachReportServer(process.env.ENFORCE_HTTPS);

app.on('error', error => console.error(error));

app.listen(process.env.PORT || 3000);

// Refresh data every 3 hours or specified duration
setInterval(() => app.load(), process.env.REFRESH_INTERVAL || 3*60*60*1000);
