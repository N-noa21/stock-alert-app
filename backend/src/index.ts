import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { stocksRouter } from "./routes/stocks";
import { lotsRouter } from "./routes/lots";
import { alertsRouter } from "./routes/alerts";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health",(_req,res) => {
    res.json({ok:true});
});

app.use("/stocks",stocksRouter);
app.use("/alerts",alertsRouter);
app.use(lotsRouter);

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});