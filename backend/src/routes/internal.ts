import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireWorkerAuth } from "../middlewares/requireWorkerAuth";

export const internalRouter = Router();

internalRouter.use(requireWorkerAuth);

internalRouter.get("/stocks/price-targets", async (_req, res) => {
  const stocks = await prisma.stock.findMany({
    select: {
      id: true,
      symbol: true,
      market: true,
      currentPrice: true,
      priceUpdatedAt: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return res.json(stocks);
});

internalRouter.patch("/stocks/:id/price", async (req, res) => {
  const stockId = Number(req.params.id);
  const { currentPrice } = req.body;

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  if (typeof currentPrice !== "number" || currentPrice <= 0) {
    return res.status(400).json({ error: "currentPrice must be positive number" });
  }

  const stock = await prisma.stock.findUnique({
    where: {
      id: stockId,
    },
  });

  if (!stock) {
    return res.status(404).json({ error: "stock not found" });
  }

  const updatedStock = await prisma.stock.update({
    where: {
      id: stockId,
    },
    data: {
      currentPrice,
      priceUpdatedAt: new Date(),
    },
  });

  return res.json(updatedStock);
});