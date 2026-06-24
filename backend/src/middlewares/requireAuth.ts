import type { NextFunction,Request,Response } from "express";
import { verifyToken } from "../lib/auth";

export type AuthenticatedRequest = Request & {
    user: {
        id:number;
    };
};

export function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const token = req.cookies?.accessToken;

    if (!token) {
        return res.status(401).json({error:"unauthorized"});
    }

    try {
        const payload = verifyToken(token);

        (req as AuthenticatedRequest).user = {
            id: payload.userId,
        };
        return next();
    } catch {
        return res.status(401).json({error:"unauthorized"});
    }
}