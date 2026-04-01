/**
 * 超级马力卡丁车俱乐部 - 后端服务
 * Express + Socket.io + SQLite
 * 实时多设备同步
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 30000,
  pingInterval: 10000,
});

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'kart.db');

// ── 初始化数据库 ──
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS race_state (
    id    INTEGER PRIMARY KEY DEFAULT 1,
    data  TEXT    NOT NULL DEFAULT '{}',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS race_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    race_date    TEXT,
    driver_count INTEGER,
    winner       TEXT,
    data         TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO race_state (id, data) VALUES (1, '{}');
`);

// ── 数据库操作 ──
const getState = () => {
  const row = db.prepare('SELECT data FROM race_state WHERE id = 1').get();
  try { return JSON.parse(row?.data || '{}'); } catch { return {}; }
};

const setState = (data) => {
  const json = JSON.stringify(data);
  db.prepare('UPDATE race_state SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(json);
};

const saveHistory = (data) => {
  const winner = data.finalResults?.[0]
    ? data.drivers?.find(d => d.id === data.finalResults[0])?.name || '?'
    : null;
  if (!winner) return;
  db.prepare(`
    INSERT INTO race_history (race_date, driver_count, winner, data)
    VALUES (?, ?, ?, ?)
  `).run(data.raceDate || new Date().toLocaleDateString('zh-CN'), data.drivers?.length || 0, winner, JSON.stringify(data));
};

const getHistory = () => {
  return db.prepare(`
    SELECT id, race_date, driver_count, winner, created_at
    FROM race_history ORDER BY created_at DESC LIMIT 20
  `).all();
};

// ── 中间件 ──
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── REST API ──

// 获取当前赛事状态
app.get('/api/state', (req, res) => {
  res.json({ ok: true, state: getState() });
});

// 更新赛事状态（裁判操作）
app.post('/api/state', (req, res) => {
  const { state } = req.body;
  if (!state || typeof state !== 'object') {
    return res.status(400).json({ ok: false, msg: '无效数据' });
  }
  setState(state);
  // 广播给所有其他设备
  io.emit('state_update', state);
  res.json({ ok: true });
});

// 保存历史记录
app.post('/api/history', (req, res) => {
  const { state } = req.body;
  if (state) saveHistory(state);
  res.json({ ok: true });
});

// 获取历史记录列表
app.get('/api/history', (req, res) => {
  res.json({ ok: true, history: getHistory() });
});

// 获取单场历史详情
app.get('/api/history/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM race_history WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, msg: '未找到' });
  try { row.data = JSON.parse(row.data); } catch {}
  res.json({ ok: true, race: row });
});

// 新赛事（清空当前状态）
app.post('/api/reset', (req, res) => {
  setState({});
  io.emit('state_update', {});
  res.json({ ok: true });
});

// 健康检查
app.get('/api/ping', (req, res) => {
  const state = getState();
  res.json({
    ok: true,
    version: '2.0.0',
    connections: io.engine.clientsCount,
    hasRace: Object.keys(state).length > 0
  });
});

// ── WebSocket ──
io.on('connection', (socket) => {
  console.log(`[WS] 设备连接 ${socket.id} 共${io.engine.clientsCount}台`);

  // 新设备连接时推送当前状态
  const state = getState();
  if (Object.keys(state).length > 0) {
    socket.emit('state_update', state);
  }

  // 客户端保存状态 → 只广播给其他设备，不回传给自己
  socket.on('save_state', (state) => {
    if (state && typeof state === 'object') {
      setState(state);
      socket.broadcast.emit('state_update', state);
    }
  });

  // 客户端保存历史记录
  socket.on('save_history', (state) => {
    if (state && typeof state === 'object') {
      try { saveHistory(state); } catch(e) {}
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WS] 设备断开 ${socket.id}`);
  });
});

// ── 所有未匹配路由返回前端 ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── 启动 ──
server.listen(PORT, () => {
  console.log(`
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🏎️  卡丁车计分系统 v2.0 后端启动
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  端口: ${PORT}
  数据库: ${DB_PATH}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});
