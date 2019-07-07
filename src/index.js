const BeachReportServer = require('./BeachReportServer');
const BeachReportData = require('./BeachReportData');

// Refresh data every 3 hours or specified duration
const provider = new BeachReportData(process.env.REFRESH_INTERVAL || 3*60*60*1000);
const app = new BeachReportServer(provider, process.env.ENFORCE_HTTPS);

app.on('error', error => console.error(error));

provider.fetch() // Do not wait for a request before loading initial data
app.listen(process.env.PORT || 3000);
