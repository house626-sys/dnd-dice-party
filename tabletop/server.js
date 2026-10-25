const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const DM_PASSWORD = process.env.DM_PASSWORD || 'ChangeThis-DM-Password-Now';
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));

function clean(value, max = 100) {
  return String(value ?? '').trim().slice(0, max);
}
function roomCode(input) {
  return clean(input, 16).toUpperCase().replace(/[^A-Z0-9-]/g, '');
}
function defaultRoom() {
  return {
    tokens: [
      { id: crypto.randomUUID(), name: 'Aria', hp: 24, maxHp: 24, x: 26, y: 44, color: '#7c8cff', owner: '' },
      { id: crypto.randomUUID(), name: 'Borin', hp: 31, maxHp: 31, x: 39, y: 57, color: '#e6a65c', owner: '' },
      { id: crypto.randomUUID(), name: 'Goblin', hp: 7, maxHp: 7, x: 66, y: 45, color: '#67b98a', owner: '' }
    ],
    background: '',
    grid: true,
    drawings: [],
    rolls: [],
    members: {}
  };
}
function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, defaultRoom());
  return rooms.get(code);
}
function publicState(room) {
  return { tokens: room.tokens, background: room.background, grid: room.grid !== false, drawings: room.drawings || [], rolls: room.rolls.slice(0, 20),
    members: Object.values(room.members).map(m => ({ name: m.name, role: m.role })) };
}
function broadcast(code) {
  const room = rooms.get(code);
  if (room) io.to(code).emit('state', publicState(room));
}

io.on('connection', socket => {
  let currentRoom = '';
  let memberName = '';
  let role = 'player';

  socket.on('join', (payload = {}, reply = () => {}) => {
    const code = roomCode(payload.room);
    const name = clean(payload.name, 24);
    if (!code || !name) return reply({ ok: false, error: 'Enter a room code and display name.' });
    const wantsDM = Boolean(payload.dm);
    if (wantsDM && clean(payload.password, 200) !== DM_PASSWORD) {
      return reply({ ok: false, error: 'DM password is incorrect.' });
    }
    if (currentRoom) {
      socket.leave(currentRoom);
      const old = rooms.get(currentRoom);
      if (old) { delete old.members[socket.id]; broadcast(currentRoom); }
    }
    currentRoom = code;
    memberName = name;
    role = wantsDM ? 'dm' : 'player';
    const room = getRoom(code);
    room.members[socket.id] = { name, role };
    socket.join(code);
    socket.data.room = code;
    socket.data.role = role;
    socket.data.name = name;
    reply({ ok: true, role, room: code, state: publicState(room) });
    broadcast(code);
  });

  socket.on('move-token', payload => {
    const room = rooms.get(currentRoom);
    if (!room || !payload) return;
    const token = room.tokens.find(t => t.id === payload.id);
    if (!token) return;
    if (role !== 'dm' && token.owner && token.owner !== memberName) return;
    token.x = Math.max(2, Math.min(98, Number(payload.x) || 0));
    token.y = Math.max(2, Math.min(98, Number(payload.y) || 0));
    broadcast(currentRoom);
  });

  socket.on('update-token', payload => {
    if (role !== 'dm' || !payload) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const token = room.tokens.find(t => t.id === payload.id);
    if (!token) return;
    if (payload.name !== undefined) token.name = clean(payload.name, 32) || token.name;
    if (payload.hp !== undefined) token.hp = Math.max(0, Math.min(9999, Number(payload.hp) || 0));
    if (payload.maxHp !== undefined) token.maxHp = Math.max(1, Math.min(9999, Number(payload.maxHp) || 1));
    if (payload.color !== undefined && /^#[0-9a-f]{6}$/i.test(payload.color)) token.color = payload.color;
    if (payload.owner !== undefined) token.owner = clean(payload.owner, 24);
    if (payload.image !== undefined) {
      const image = String(payload.image || '');
      if (!image || /^https?:\\/\\//i.test(image) || /^data:image\\/(png|jpeg|webp|gif);base64,/i.test(image)) token.image = image.slice(0, 1200000);
    }
    broadcast(currentRoom);
  });

  socket.on('add-token', () => {
    if (role !== 'dm') return;
    const room = rooms.get(currentRoom);
    if (!room || room.tokens.length >= 100) return;
    room.tokens.push({ id: crypto.randomUUID(), name: 'New Character', hp: 10, maxHp: 10,
      x: 50, y: 50, color: '#bd85e8', owner: '' });
    broadcast(currentRoom);
  });

  socket.on('delete-token', id => {
    if (role !== 'dm') return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.tokens = room.tokens.filter(t => t.id !== id);
    broadcast(currentRoom);
  });

  socket.on('set-background', value => {
    if (role !== 'dm') return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const url = clean(value, 2000);
    if (url && !/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) return;
    room.background = url;
    broadcast(currentRoom);
  });


  socket.on('set-grid', enabled => {
    if (role !== 'dm') return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.grid = Boolean(enabled);
    broadcast(currentRoom);
  });

  socket.on('add-drawing', drawing => {
    if (role !== 'dm' || !drawing || !Array.isArray(drawing.points)) return;
    const room = rooms.get(currentRoom);
    if (!room || room.drawings.length >= 500) return;
    const points = drawing.points.slice(0, 2000).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
      .map(p => ({x: Math.max(0, Math.min(1000, p.x)), y: Math.max(0, Math.min(1000, p.y))}));
    if (points.length < 2) return;
    const color = /^#[0-9a-f]{6}$/i.test(drawing.color || '') ? drawing.color : '#f5d77a';
    const width = Math.max(1, Math.min(24, Number(drawing.width) || 4));
    room.drawings.push({id: crypto.randomUUID(), points, color, width});
    broadcast(currentRoom);
  });

  socket.on('undo-drawing', () => {
    if (role !== 'dm') return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.drawings.pop();
    broadcast(currentRoom);
  });

  socket.on('clear-drawings', () => {
    if (role !== 'dm') return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.drawings = [];
    broadcast(currentRoom);
  });

  socket.on('import-state', payload => {
    if (role !== 'dm' || !payload || !Array.isArray(payload.tokens)) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.tokens = payload.tokens.slice(0, 100).map(t => ({
      id: typeof t.id === 'string' ? t.id.slice(0, 80) : crypto.randomUUID(),
      name: clean(t.name, 32) || 'Character',
      hp: Math.max(0, Math.min(9999, Number(t.hp) || 0)),
      maxHp: Math.max(1, Math.min(9999, Number(t.maxHp) || 1)),
      x: Math.max(2, Math.min(98, Number(t.x) || 50)),
      y: Math.max(2, Math.min(98, Number(t.y) || 50)),
      color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : '#bd85e8',
      owner: clean(t.owner, 24),
      image: typeof t.image === 'string' ? t.image.slice(0, 1200000) : ''
    }));
    if (typeof payload.background === 'string' && payload.background.length <= 1800000) room.background = payload.background;
    room.grid = payload.grid !== false;
    if (Array.isArray(payload.drawings)) room.drawings = payload.drawings.slice(0, 500);
    broadcast(currentRoom);
  });

  socket.on('roll', payload => {
    const room = rooms.get(currentRoom);
    if (!room) return;
    const sides = Math.max(2, Math.min(1000, Number(payload?.sides) || 20));
    const count = Math.max(1, Math.min(20, Number(payload?.count) || 1));
    const values = Array.from({ length: count }, () => crypto.randomInt(1, sides + 1));
    const result = { id: crypto.randomUUID(), name: memberName, sides, values, total: values.reduce((a, b) => a + b, 0), time: Date.now() };
    room.rolls.unshift(result);
    room.rolls = room.rolls.slice(0, 20);
    io.to(currentRoom).emit('roll-result', result);
    broadcast(currentRoom);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(currentRoom);
    if (room) { delete room.members[socket.id]; broadcast(currentRoom); }
  });
});

server.listen(PORT, '0.0.0.0', () => console.log('Adventurers Tabletop listening on ' + PORT));
