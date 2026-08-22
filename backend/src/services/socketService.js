let io = null;

function initIO(server, corsOrigin) {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: { origin: corsOrigin } });

  io.on('connection', (socket) => {
    socket.on('joinShow', (showId) => socket.join(`show:${showId}`));
    socket.on('leaveShow', (showId) => socket.leave(`show:${showId}`));
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initIO, getIO };
