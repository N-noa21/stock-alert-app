import { Router } from "express";
import { prisma } from "../lib/prisma";

export const stocksRouter = Router();

stocksRouter.get("/",async (_req,res) => {
    const stocks = await prisma.stock.findMany({
        orderBy: {
            id: "asc",
        },
    });

    return res.json(stocks);
});

stocksRouter.post("/",async (req,res) => {
    const {symbol,name,market} = req.body;

    if (typeof symbol !== "string" || symbol.length === 0) {
        return res.status(400).json({error:"symbol is required"});
    }

    if (market !== "JP" && market !== "US") {
        return res.status(400).json({error:"market must be JP or US"});
    }

    try {
        const stock = await prisma.stock.create({
            data: {
                symbol,
                name: typeof name === "string" ? name:null,
                market,
            },
        });

        return res.status(201).json(stock);
    } catch (error) {
        return res.status(500).json({error:"failed to create stock"});
    }

});

stocksRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  const stock = await prisma.stock.findUnique({
    where: {
      id,
    },
    include: {
      lots: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (stock === null) {
    return res.status(404).json({ error: "stock not found" });
  }

  const totalQuantity = stock.lots.reduce((sum, lot) => {
    return sum + lot.quantity;
  }, 0);

  const totalCost = stock.lots.reduce((sum, lot) => {
    return sum + lot.quantity * lot.buyPrice;
  }, 0);

  const averageBuyPrice =
    totalQuantity === 0 ? null : totalCost / totalQuantity;

  return res.json({
    ...stock,
    totalQuantity,
    totalCost,
    averageBuyPrice,
  });
});

stocksRouter.patch("/:id/price",async (req,res) => {
  const stockId = Number(req.params.id);
  const { currentPrice } = req.body;

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({error:"invalid stock id"});
  }

  if (typeof currentPrice !== "number" || currentPrice <= 0) {
    return res.status(400).json({error:"currentPrice must be positive number"});
  }

  try {
    const stock = await prisma.stock.update({
      where: {
        id: stockId,
      },
      data: {
        currentPrice,
      },
    });
    return res.json(stock);
  } catch (error) {
    return res.status(404).json({error:"stock not found"});
  }
});

stocksRouter.get("/:id/summary", async (req,res) => {
  const stockId = Number(req.params.id);
  if (!Number.isInteger(stockId)) {
    return res.status(400).json({error:"invalid stock id"});
  }

  const stock = await prisma.stock.findUnique({
    where: {
      id: stockId,
    },
    include: {
      lots: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (!stock) {
    return res.status(404).json({error:"stock not found"});
  }

  if (stock.currentPrice === null) {
    return res.status(400).json({error:"current price is not set"});
  }

  const currentPrice = Number(stock.currentPrice);

  const totalShares = stock.lots.reduce((sum,lot) => {
    return sum + lot.quantity;
  },0);

  const totalBuyAmount = stock.lots.reduce((sum,lot) => {
    return sum+ lot.quantity * Number(lot.buyPrice);
  },0);

  const averageBuyPrice = totalShares === 0 ? null : totalBuyAmount / totalShares;

  const currentValue = totalShares * currentPrice;

  const profitLoss = currentValue - totalBuyAmount;

  const profitLossRate = totalBuyAmount === 0 ? null : profitLoss / totalBuyAmount;

  return res.json({
    stock: {
      id: stock.id,
      symbol: stock.symbol,
      name: stock.name,
      market: stock.market,
      currentPrice,
    },
    totalShares,
    totalBuyAmount,
    averageBuyPrice,
    currentValue,
    profitLoss,
    profitLossRate,
    lots: stock.lots,
  });


})

stocksRouter.get("/:stockId/alerts", async (req,res) => {
  const stockId = Number(req.params.stockId);

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({error:"invalid stockId"});
  }

  const stock = await prisma.stock.findUnique({
    where: {id:stockId},
  });

  if (!stock) {
    return res.status(404).json({error:"status not found"});
  }

  const alerts = await prisma.stockAlert.findMany({
    where: { stockId },
    orderBy: {
      id: "asc",
    },
  });
  return res.json(alerts);
});

stocksRouter.post("/:stockId/alerts",async (req,res) => {
  const stockId = Number(req.params.stockId);
  const {direction, targetPrice} = req.body;

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({error:"invalid stockId"});
  }

  if (direction !== "ABOVE" && direction !== "BELOW") {
    return res.status(400).json({error:"direction must be ABOVE or BELOW"});
  }

  const priceNumber = Number(targetPrice);

  if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
    return res.status(400).json({error:"targetPrice must be positive number"});
  }

  const stock = await prisma.stock.findUnique({
    where: {id:stockId},
  });

  if (!stock) {
    return res.status(404).json({error:"stock not found"});
  }

  const alert = await prisma.stockAlert.create({
    data: {
      stockId,
      direction,
      targetPrice: priceNumber,
    },
  });

  return res.status(201).json(alert);
});