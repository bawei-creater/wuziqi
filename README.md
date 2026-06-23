# wuziqi

wuziqi 是一个基于 Node.js 和原生 WebSocket 的五子棋项目，提供本地双人对弈和在线房间对战两种玩法。前端使用单文件 HTML5 Canvas 实现棋盘、落子、音效、比分和弹窗交互，后端负责房间创建、加入、落子同步、胜负判断、悔棋和重开。

## 功能概览

- 本地双人模式：同一浏览器中黑白轮流落子。
- 在线对战模式：创建房间、输入房间号加入、分享房间链接。
- 观战能力：房间满员后可作为 spectator 加入。
- 实时同步：WebSocket 推送棋盘、回合、胜负和重开状态。
- 悔棋流程：在线模式支持发起悔棋、同意/拒绝，服务端统一回滚棋局。
- 游戏体验：Canvas 棋盘、落子音效、胜利音效、比分统计。
- 简单部署：Node.js 服务同时提供静态页面和 WebSocket 服务。

## 技术栈

- 后端：Node.js, `ws`
- 前端：HTML5 Canvas, JavaScript, Web Audio API
- 部署：Node 进程 + Nginx 反向代理 WebSocket

## 目录结构

```text
wuziqi/
├── server.js                  # HTTP 静态服务与 WebSocket 房间服务
├── gomoku-all.html            # 本地/在线整合版页面
├── gomoku.html                # 本地页面
├── gomoku-online.html         # 在线页面
├── deploy-nginx-wuziqi.conf   # Nginx 部署示例
├── package.json
└── supabase.min.js            # 预留/静态依赖文件
```

## 本地运行

安装依赖：

```bash
npm install
```

启动服务：

```bash
npm start
```

默认访问：

```text
http://127.0.0.1:3000/
```

也可以通过环境变量指定端口：

```bash
PORT=3002 npm start
```

## 在线对战流程

1. 打开首页后选择在线对战。
2. 一名玩家点击创建房间，系统生成房间号。
3. 另一名玩家输入房间号加入，双方进入对局。
4. 黑棋先手，双方轮流落子。
5. 任意方向连续五子即获胜。
6. 对局中可以申请悔棋，对方同意后服务端回滚最近两手。

## 服务端设计

`server.js` 同时承担两类职责：

- HTTP 静态文件服务：默认 `/` 返回 `gomoku-all.html`。
- WebSocket 服务：维护 `rooms` 内存 Map，处理 `create`、`join`、`move`、`undo_request`、`undo_accept`、`undo_reject`、`restart` 等消息。

房间状态保存在内存中，包含 15x15 棋盘、当前回合、黑白玩家连接、历史落子、胜负状态和悔棋请求状态。

## 部署说明

生产部署可以使用 Node 进程托管服务，再用 Nginx 做路径代理。仓库中的 `deploy-nginx-wuziqi.conf` 提供了一个示例配置。

反向代理时需要注意 WebSocket 头部：

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

如果部署在子路径，例如 `/wuziqi/`，需要确认前端资源路径和 WebSocket 地址与反向代理规则一致。

## 注意事项

- 当前房间状态仅保存在内存中，服务重启后会丢失。
- WebSocket 连接断开后，服务端会清理玩家并通知对手。
- 在线模式适合轻量级演示和课程项目，如需长期运营建议增加持久化、断线重连和房间过期清理。
