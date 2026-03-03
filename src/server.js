require('dotenv').config();
const http       = require('http');
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');

const logger           = require('./utils/logger');
const ussdRoutes       = require('./ussd/routes');
const eventUssdRoutes  = require('./ussd/examples/eventRegistration');
// const voiceRoutes      = require('./voice/routes');
// const voiceExamplesRoutes = require('./voice/examples/callActions');
// const geminiVoiceRoutes   = require('./voice/geminiVoice');
// const liveVoiceRoutes     = require('./voice/liveVoice');
// const webrtcRoutes        = require('./webrtc/routes');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { body: req.body, query: req.query });
  next();
});

app.get('/', (req, res) => {
  res.json({ status: 'success', message: "Africa's Talking Workshop API", timestamp: new Date().toISOString() });
});


app.use('/ussd',           ussdRoutes);
app.use('/ussd/event',     eventUssdRoutes);
// app.use('/voice',          voiceRoutes);
// app.use('/voice/examples', voiceExamplesRoutes);
// app.use('/voice/ai',       geminiVoiceRoutes);
// app.use('/voice/live',     liveVoiceRoutes);
// app.use('/webrtc',         webrtcRoutes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({ status: 'error', message: err.message || 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
