const os = require('os');
const networkInterfaces = os.networkInterfaces();

const ipv4 =
  Object.values(networkInterfaces).flat().find(info => info.family === 'IPv4' && !info.internal)?.address || '127.0.0.1';

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const NGROK_ORIGIN = 'https://winford-subaverage-foreseeingly.ngrok-free.dev';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5173',
  `http://${ipv4}:3000`,
  `http://${ipv4}:5173`,
  NGROK_ORIGIN,
];

module.exports = { ipv4, PORT, JWT_SECRET, ALLOWED_ORIGINS };
