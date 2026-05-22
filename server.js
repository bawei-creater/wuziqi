const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;

// ===== 房间管理 =====
const rooms = new Map();

function createRoom(id) {
  rooms.set(id, {
    board: Array.from({ length: 15 }, () => Array(15).fill(0)),
    currentTurn: 1, // 1=black, 2=white
    players: {},     // { black: ws, white: ws }
    status: "waiting",
    winner: null
  });
  return rooms.get(id);
}

function genId() {
  return Math.random().toString(36).substring(2, 8);
}

// ===== HTTP 服务器（提供静态文件）=====
const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/gomoku-all.html" : req.url;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": types[ext] || "text/plain", "Access-Control-Allow-Origin": "*" });
    res.end(data);
  });
});

// ===== WebSocket 服务器 =====
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let myRoom = null;
  let myRole = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "create") {
      const id = genId();
      const room = createRoom(id);
      room.players.black = ws;
      myRoom = id;
      myRole = "black";
      ws.send(JSON.stringify({ type: "created", roomId: id, role: "black", board: room.board, turn: room.currentTurn }));
    }

    if (msg.type === "join") {
      const room = rooms.get(msg.roomId);
      if (!room) { ws.send(JSON.stringify({ type: "error", msg: "房间不存在" })); return; }
      if (!room.players.black) {
        room.players.black = ws;
        myRole = "black";
      } else if (!room.players.white) {
        room.players.white = ws;
        myRole = "white";
      } else {
        myRole = "spectator";
      }
      myRoom = msg.roomId;
      ws.send(JSON.stringify({ type: "joined", roomId: msg.roomId, role: myRole, board: room.board, turn: room.currentTurn, status: room.status }));
      // 通知双方游戏开始
      if (room.players.black && room.players.white && room.status === "waiting") {
        room.status = "playing";
        broadcast(msg.roomId, { type: "start" });
      }
    }

    if (msg.type === "move" && myRoom) {
      const room = rooms.get(myRoom);
      if (!room || room.status !== "playing") return;
      const { r, c } = msg;
      const isMyTurn = (myRole === "black" && room.currentTurn === 1) || (myRole === "white" && room.currentTurn === 2);
      if (!isMyTurn || room.board[r][c]) return;
      room.board[r][c] = room.currentTurn;
      // 检查胜负
      const winner = checkWin(room.board, r, c, room.currentTurn);
      if (winner) {
        room.status = "finished";
        room.winner = winner;
        broadcast(myRoom, { type: "move", r, c, player: room.currentTurn });
        broadcast(myRoom, { type: "win", winner });
      } else {
        room.currentTurn = room.currentTurn === 1 ? 2 : 1;
        broadcast(myRoom, { type: "move", r, c, player: room.currentTurn === 1 ? 2 : 1 });
        broadcast(myRoom, { type: "turn", turn: room.currentTurn });
      }
    }

    if (msg.type === "restart" && myRoom) {
      const room = rooms.get(myRoom);
      if (!room) return;
      room.board = Array.from({ length: 15 }, () => Array(15).fill(0));
      room.currentTurn = 1;
      room.status = "playing";
      room.winner = null;
      // 交换先后手
      const tmp = room.players.black;
      room.players.black = room.players.white;
      room.players.white = tmp;
      broadcast(myRoom, { type: "restart", board: room.board, turn: 1 });
    }
  });

  ws.on("close", () => {
    if (myRoom) {
      const room = rooms.get(myRoom);
      if (room) {
        broadcast(myRoom, { type: "opponent_left" });
        rooms.delete(myRoom);
      }
    }
  });
});

function broadcast(roomId, msg) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(msg);
  if (room.players.black) room.players.black.send(data);
  if (room.players.white) room.players.white.send(data);
}

function checkWin(board, r, c, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const nr = r + dr*i, nc = c + dc*i;
      if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15 || board[nr][nc] !== player) break;
      count++;
    }
    for (let i = 1; i < 5; i++) {
      const nr = r - dr*i, nc = c - dc*i;
      if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15 || board[nr][nc] !== player) break;
      count++;
    }
    if (count >= 5) return player === 1 ? "black" : "white";
  }
  return null;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`等待安装 ws 模块后重启...`);
});
