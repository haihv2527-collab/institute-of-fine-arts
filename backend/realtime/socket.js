const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

let io = null;

/**
 * Rooms convention:
 *   user:<user_id>     — every connected socket joins its own user room,
 *                         used to push a notification to one specific person
 *   role:<role>         — every socket also joins a room for its role,
 *                         used to notify "all staff" / "all managers" etc.
 */
function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" }, // fine for a same-origin deployed app; tighten if split-hosting frontend/backend
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("Missing token"));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = db
        .prepare("SELECT id, role, full_name, is_active FROM users WHERE id = ?")
        .get(payload.id);

      if (!user || !user.is_active) return next(new Error("Invalid session"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);
  });

  console.log("Socket.io realtime layer ready.");
  return io;
}

function getIo() {
  if (!io) throw new Error("Socket.io has not been initialized yet — call initRealtime(server) first.");
  return io;
}

/** Push an event to one specific logged-in user (e.g. a student). */
function notifyUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/** Push an event to everyone currently logged in with a given role. */
function notifyRole(role, event, payload) {
  if (!io) return;
  io.to(`role:${role}`).emit(event, payload);
}

module.exports = { initRealtime, getIo, notifyUser, notifyRole };
