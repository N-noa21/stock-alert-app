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

app.set("trust proxy", 1);

const frontendUrl = process.env.FRONTEND_URL;

if (!frontendUrl) {
  throw new Error("FRONTEND_URL is not set");
}

app.use(
  cors({
    origin: frontendUrl,
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

const port = Number(process.env.PORT ?? 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(`server listening on port ${port}`);
});