import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDatabase from "./config/database.js";
import authRoute from "./routes/auth.js";
import productRoute from "./routes/product.js";
import OrderRoute from "./routes/order.js";
import AdminRouter from "./routes/admin.js";

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

app.use("/api/auth", authRoute);
app.use("/api/product", productRoute);
app.use("/api/order", OrderRoute);
app.use("/api/admin", AdminRouter);

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
