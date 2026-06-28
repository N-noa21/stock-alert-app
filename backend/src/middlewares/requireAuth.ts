import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth";

export type AuthenticatedRequest = Request & {
  user: {
    id: number;
  };
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.token;

  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

  const token = cookieToken ?? bearerToken;

  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = verifyToken(token);

    (req as AuthenticatedRequest).user = {
      id: payload.userId,
    };

    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}