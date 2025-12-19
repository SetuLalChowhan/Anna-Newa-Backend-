import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDatabase from "./config/database.js";
import AuthRoute from "./routes/auth.js";
import ProductRoute from "./routes/product.js";
import  CategoryRoutes from "./routes/categoryRoutes.js"
import OrderRoute from "./routes/order.js";
import AdminRouter from "./routes/admin.js";
import ArticleRouter from "./routes/article.js"
import AiChatRouter from "./routes/aiRouter.js"
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
app.use('/api/categories', CategoryRoutes);
app.use("/api/order", OrderRoute);
app.use("/api/admin", AdminRouter);
app.use("/api/ai", AiChatRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
