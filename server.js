const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));

function cleanText(value, max = 28) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
}
function getRoom(roomCode) {
  if (!rooms.has(roomCode)) rooms.set(roomCode, { players: new Map(), rolls: [] });
  return rooms.get(roomCode);
}
function snapshot(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit('room-state', {
    players: [...room.players.values()],
    rolls: room.rolls.slice(-60)
  });
}
function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }

io.on('connection', socket => {
  socket.on('join-room', ({ name, roomCode } = {}) => {
    name = cleanText(name, 24) || 'Adventurer';
    roomCode = cleanText(roomCode, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{4,8}$/.test(roomCode)) {
      socket.emit('join-error', 'Room codes must be 4–8 letters or numbers.');
      return;
    }
    if (socket.data.roomCode) leaveRoom(socket);
    const room = getRoom(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.playerId = socket.id;
    socket.join(roomCode);
    room.players.set(socket.id, { id: socket.id, name, joinedAt: Date.now() });
    socket.emit('joined-room', { roomCode, name });
    room.rolls.push({ id: `${Date.now()}-${socket.id}`, kind: 'system', name: 'Table', text: `${name} joined the party.`, time: Date.now() });
    room.rolls = room.rolls.slice(-60);
    snapshot(roomCode);
  });

  socket.on('roll', payload => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms.has(roomCode)) return;
    const room = rooms.get(roomCode);
    const player = room.players.get(socket.id);
    if (!player) return;
    const count = Math.max(1, Math.min(100, Number.parseInt(payload?.count, 10) || 1));
    const sides = Number.parseInt(payload?.sides, 10);
    const modifier = Math.max(-100000, Math.min(100000, Number.parseInt(payload?.modifier, 10) || 0));
    if (![2,3,4,6,8,10,12,20,100].includes(sides)) return;
    const label = cleanText(payload?.label, 48);
    const rolls = Array.from({ length: count }, () => rollDie(sides));
    const subtotal = rolls.reduce((a,b) => a+b, 0);
    room.rolls.push({
      id: `${Date.now()}-${socket.id}-${Math.random().toString(36).slice(2,7)}`,
      kind: 'roll', name: player.name, playerId: socket.id, time: Date.now(),
      count, sides, modifier, rolls, subtotal, total: subtotal + modifier, label
    });
    room.rolls = room.rolls.slice(-60);
    snapshot(roomCode);
  });

  socket.on('clear-history', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms.has(roomCode)) return;
    const room = rooms.get(roomCode);
    const player = room.players.get(socket.id);
    if (!player) return;
    room.rolls = [{ id: `${Date.now()}-${socket.id}`, kind: 'system', name: 'Table', text: `${player.name} cleared the roll history.`, time: Date.now() }];
    snapshot(roomCode);
  });

  socket.on('disconnect', () => leaveRoom(socket));
});

function leaveRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  socket.leave(roomCode);
  socket.data.roomCode = null;
  if (!room) return;
  const player = room.players.get(socket.id);
  room.players.delete(socket.id);
  if (player) {
    room.rolls.push({ id: `${Date.now()}-${socket.id}`, kind: 'system', name: 'Table', text: `${player.name} left the party.`, time: Date.now() });
    room.rolls = room.rolls.slice(-60);
  }
  if (room.players.size === 0) rooms.delete(roomCode);
  else snapshot(roomCode);
}

server.listen(PORT, '0.0.0.0', () => console.log(`D&D Dice Party running on port ${PORT}`));
