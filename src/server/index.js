const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const socketHandlers = require('./socket-handlers');
const stats = require('../lib/stats');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

function start(port, config, callback) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.use(cors());
  app.use(express.static(PUBLIC_DIR, {
    setHeaders: function(res, filePath) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));

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

  app.get('/editor', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'editor.html'));
  });

  app.get('/practice', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'practice.html'));
  });

  app.get('/api/practice-data', (req, res) => {
    res.json({
      columns: config.columns,
      rows: config.rows,
      categories: config.categories,
      clues: config.clues,
      answers: config.answers,
      categoriesR2: config.categoriesR2,
      cluesR2: config.cluesR2,
      answersR2: config.answersR2,
      baseValues: config.baseValues,
      doubleValues: config.doubleValues,
      championshipQuestions: config.championshipQuestions
    });
  });

  app.get('/api/usage-stats', (req, res) => {
    var data = stats.getAll();
    res.json({ stats: data, collected: true, notice: 'Anonymous usage statistics. No personal data collected.' });
  });

  app.get('/api/stats', (req, res) => {
    var gs = socketHandlers.getGameState();
    if (gs) {
      res.json(gs.getPlayerStats());
    } else {
      res.json({ game: {}, players: [] });
    }
  });

  socketHandlers.setup(io, config);

  server.listen(port, '0.0.0.0', () => {
    if (callback) callback();
  });

  return server;
}

module.exports = { start };
