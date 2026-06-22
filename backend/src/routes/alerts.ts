import { Router } from "express";
import { prisma } from "../lib/prisma"
import { error } from "node:console";

export const alertsRouter = Router();

alertsRouter.patch("/:alertId",async (req,res) => {
    const alertId = Number(req.params.alertId);
    const { isActive } = req.body;

    if (!Number.isInteger(alertId)) {
        return res.status(400).json({error:"invalid alertId"});
    }

    if (typeof isActive !== "boolean") {
        return res.status(400).json({error:"isActive must be boolean"});
    }
    
    const existingAlert = await prisma.stockAlert.findUnique({
        where: {
            id:alertId,
        },
    });

    if (!existingAlert) {
        return res.status(404).json({error:"alert not found"});
    }

    const alert = await prisma.stockAlert.update({
        where: {id: alertId},
        data: {
            isActive,
        },
    });

    return res.json(alert);
});

alertsRouter.delete("/:alertId",async (req,res) => {
    const alertId = Number(req.params.alertId);

    if (!Number.isInteger(alertId)) {
        return res.status(400).json({error:"invalid alertId"});
    }

    const existingAlert = await prisma.stockAlert.findUnique({
        where: {id:alertId},
    });

    if (!existingAlert) {
        return res.status(404).json({error:"alert not found"});
    }

    await prisma.stockAlert.delete({
        where: {id:alertId},
    });
    return res.status(204).send();
});
