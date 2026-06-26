import type { Request, Response, NextFunction } from "express";

export function requireWorkerAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const workerSecret = process.env.WORKER_SECRET;

  if (!workerSecret) {
    return res.status(500).json({ error: "WORKER_SECRET is not set" });
  }

  const token = req.header("x-worker-token");

  if (token !== workerSecret) {
    return res.status(401).json({ error: "unauthorized worker" });
  }

  next();
}