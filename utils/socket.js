import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("joinProduct", (productId) => {
      socket.join(productId);
      console.log(`User ${socket.id} joined product room: ${productId}`);
    });

    socket.on("leaveProduct", (productId) => {
      socket.leave(productId);
      console.log(`User ${socket.id} left product room: ${productId}`);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

export const emitNewBid = (productId, bidData) => {
  if (io) {
    io.to(productId.toString()).emit("newBid", {
      productId,
      bid: bidData,
    });
  }
};
