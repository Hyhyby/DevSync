const { ALLOWED_ORIGINS } = require('./network');

const NGROK_REGEXES = [
  /^https:\/\/[a-z0-9-]+\.ngrok\.app$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/i,
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return NGROK_REGEXES.some(r => r.test(origin));
}

const corsOptions = {
  origin(origin, cb) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'OPTIONS'],
};

module.exports = { corsOptions, isAllowedOrigin };
