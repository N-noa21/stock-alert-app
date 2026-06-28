import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

export const authRouter = Router();

const isProduction = process.env.NODE_ENV === "production";

const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 7,
} as const;

authRouter.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (typeof name !== "string" || name.length === 0) {
    return res.status(400).json({ error: "name is required" });
  }

  if (typeof email !== "string" || email.length === 0) {
    return res.status(400).json({ error: "email is required" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res.status(409).json({ error: "email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });


  const token = signToken({ userId: user.id });

  res.cookie("token", token, authCookieOptions);

  return res.status(201).json({
    user,
    token,
  });

});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || email.length === 0) {
    return res.status(400).json({ error: "email is required" });
  }

  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ error: "password is required" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ error: "invalid email or password" });
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    return res.status(401).json({ error: "invalid email or password" });
  }

  const token = signToken({ userId: user.id });
  
  res.cookie("token", token, authCookieOptions);
  
  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    token,
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;

  const user = await prisma.user.findUnique({
    where: {
      id: authReq.user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  return res.json(user);
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });

  return res.json({ message: "logged out" });
});
