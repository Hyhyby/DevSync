const fs = require('fs');
const path = require('path');
const ROOMS_FILE = path.join(__dirname, '..', 'rooms.json');

function loadRooms() {
  try {
    const data = fs.readFileSync(ROOMS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveRooms(rooms) {
  fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2));
}

module.exports = { loadRooms, saveRooms };
