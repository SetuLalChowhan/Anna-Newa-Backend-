import express from "express";
import { createServer } from "http";
import { initSocket } from "./utils/socket.js";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDatabase from "./config/database.js";
import AuthRoute from "./routes/auth.js";
import ProductRoute from "./routes/product.js";
import CategoryRoutes from "./routes/categoryRoutes.js";
import OrderRoute from "./routes/order.js";
import AdminRouter from "./routes/admin.js";
import ArticleRouter from "./routes/article.js";
import AiChatRouter from "./routes/aiRouter.js";
import SystemInfoRoute from "./routes/systemInfoRoutes.js";
import ContactRoute from "./routes/contactRoutes.js";
import DashboardRoute from "./routes/dashboard.js";
connectDatabase();
const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api/auth", AuthRoute);
app.use("/api/product", ProductRoute);
app.use("/api/article", ArticleRouter);
app.use("/api/categories", CategoryRoutes);
app.use("/api/order", OrderRoute);
app.use("/api/admin", AdminRouter);
app.use("/api/ai", AiChatRouter);
app.use("/api/system-info", SystemInfoRoute);
app.use("/api/contact", ContactRoute);
app.use("/api/dashboard", DashboardRoute);

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
