import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

interface UserInfo {
  id: string;
  nickname: string;
  personalColor: string;
}

const rooms = new Map<string, Set<string>>();
const userInfos = new Map<string, UserInfo>();

const users: { [key: string]: { socketId: string; roomId?: string } } = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  users[socket.id] = { socketId: socket.id };

  socket.on("join", (roomId) => {
    console.log(`User ${socket.id} joining room ${roomId}`);
    socket.join(roomId);
    users[socket.id].roomId = roomId;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId)?.add(socket.id);

    // 현재 방의 모든 사용자 정보 전송
    const roomUsers = Array.from(rooms.get(roomId) || []);
    const roomUserInfos = roomUsers.reduce((acc, userId) => {
      const userInfo = userInfos.get(userId);
      if (userInfo) {
        acc[userId] = userInfo;
      }
      return acc;
    }, {} as { [key: string]: UserInfo });

    io.to(roomId).emit("users", roomUserInfos);
  });

  socket.on("update_user_info", ({ nickname, personalColor, roomId }) => {
    const userInfo: UserInfo = {
      id: socket.id,
      nickname,
      personalColor,
    };
    userInfos.set(socket.id, userInfo);

    if (roomId) {
      const roomUsers = Array.from(rooms.get(roomId) || []);
      const roomUserInfos = roomUsers.reduce((acc, userId) => {
        const info = userInfos.get(userId);
        if (info) {
          acc[userId] = info;
        }
        return acc;
      }, {} as { [key: string]: UserInfo });

      io.to(roomId).emit("users", roomUserInfos);
    }
  });

  socket.on("offer", ({ offer, roomId }) => {
    console.log(`Received offer from ${socket.id} for room ${roomId}`);
    socket.to(roomId).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ answer, roomId }) => {
    console.log(`Received answer from ${socket.id} for room ${roomId}`);
    socket.to(roomId).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ candidate, roomId }) => {
    console.log(`Received ICE candidate from ${socket.id} for room ${roomId}`);
    socket.to(roomId).emit("ice-candidate", {
      candidate,
      from: socket.id,
    });
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (rooms.has(room)) {
        rooms.get(room)?.delete(socket.id);
        io.to(room).emit("users", Array.from(rooms.get(room) || []));
      }
    }
  });

  socket.on("disconnect", () => {
    const roomId = users[socket.id]?.roomId;
    if (roomId) {
      io.to(roomId).emit("users", getUsers(roomId));
    }
    delete users[socket.id];
  });
});

function getUsers(roomId: string) {
  return Object.entries(users)
    .filter(([_, user]) => user.roomId === roomId)
    .reduce((acc, [socketId, user]) => {
      acc[socketId] = user;
      return acc;
    }, {} as { [key: string]: any });
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
