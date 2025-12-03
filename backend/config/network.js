// config/network.js
const os = require("os");

function getRealIPv4() {
  const nets = os.networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (
        net.family === "IPv4" &&
        !net.internal && // 127.0.0.1 제외
        !net.address.startsWith("169.254.") // APIPA (가짜 IP) 제외
      ) {
        return net.address;
      }
    }
  }

  // 못 찾으면 그냥 localhost
  return "127.0.0.1";
}

const ipv4 = getRealIPv4();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "access-secret";
const NGROK_ORIGIN =
  "https://commensurately-preflagellate-merissa.ngrok-free.dev";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5000",
  "http://localhost:5173",
  `http://${ipv4}:3000`,
  `http://${ipv4}:5173`,
  NGROK_ORIGIN,
];

module.exports = { ipv4, PORT, JWT_SECRET, ALLOWED_ORIGINS };
