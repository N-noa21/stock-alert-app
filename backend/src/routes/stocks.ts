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