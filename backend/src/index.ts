import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import { stocksRouter } from "./routes/stocks";
import { lotsRouter } from "./routes/lots";
import { alertsRouter } from "./routes/alerts";
import { authRouter } from "./routes/auth";
import { internalRouter } from "./routes/internal";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health",(_req,res) => {
    res.json({ok:true});
});

app.use("/auth", authRouter);
app.use("/stocks",stocksRouter);
app.use("/internal", internalRouter);
app.use("/alerts",alertsRouter);
app.use(lotsRouter);

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});