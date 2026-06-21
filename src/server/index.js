const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const socketHandlers = require('./socket-handlers');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

function start(port, config, callback) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.use(cors());
  app.use(express.static(PUBLIC_DIR));

  app.get('/broadcast', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'broadcast.html'));
  });

  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
  });

  app.get('/helper-scoring', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'helper-scoring.html'));
  });

  app.get('/helper-board', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'helper-board.html'));
  });

  socketHandlers.setup(io, config);

  server.listen(port, '0.0.0.0', () => {
    if (callback) callback();
  });

  return server;
}

module.exports = { start };
