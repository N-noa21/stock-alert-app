import { Router } from "express";
import {prisma} from "../lib/prisma"
import { error } from "node:console";

export const lotsRouter = Router();

lotsRouter.get("/stocks/:stockId/lots", async (req,res) => {
    const stockId = Number(req.params.stockId);

    if (Number.isNaN(stockId)) {
        return res.status(400).json({error:"invalid stock id"});
    }

    const lots = await prisma.stockLot.findMany({
        where: {
            stockId,
        },
        orderBy: {
            id: "asc",
        },
    });

    return res.json(lots);
});

lotsRouter.post("/stocks/:stockId/lots", async (req,res) => {
    const stockId = Number(req.params.stockId);
    const { quantity,buyPrice} = req.body;

    if (Number.isNaN(stockId)) {
        return res.status(400).json({error:"invalid stock id"});
    }

    if (typeof quantity !== "number" || quantity <= 0) {
        return res.status(400).json({error:"quantity must be a positive number"});
    }

    if (typeof buyPrice !== "number" || buyPrice <= 0) {
        return res.status(400).json({error:"buyPrice must be a positive number"});
    }

    const stock = await prisma.stock.findUnique({
        where: {
            id:stockId,
        },
    });

    if (stock == null) {
        return res.status(404).json({error:"stock not found"});
    }

    const lot = await prisma.stockLot.create({
        data: {
            stockId,
            quantity,
            buyPrice,
        },
    });
    return res.status(201).json(lot);
});

lotsRouter.delete("/lots/:lotId",async (req,res) => {
    const lotId = Number(req.params.lotId);

    if (Number.isNaN(lotId)) {
        return res.status(400).json({ error: "invalid lot id" });
    }

    const lot = await prisma.stockLot.findUnique({
        where: {
            id: lotId,
        },
    });

    if (lot == null) {
        return res.status(404).json({error:"lot not found"});
    }

    await prisma.stockLot.delete({
        where: {
            id: lotId,
        },
    });
    return res.status(204).send();
});

