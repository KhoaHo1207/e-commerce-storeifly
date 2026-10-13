import { prisma } from "@/config/prisma.js";
import { findNeonUser } from "@/services/neonUser.js";
import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "merchant" | "customer";
  store_id?: number | null;
}

export interface AuthenicatedRequest extends Request {
  user?: AuthUser;
}

const neonJWKS = createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL));

const claimString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const resolveRole = (
  dbRole: string | null | undefined,
  tokenRole: string,
  hasStore: boolean
): AuthUser["role"] => {
  const role = dbRole || tokenRole;
  if (role === "admin") {
    return "admin";
  }
  if (role === "merchant" || hasStore) {
    return "merchant";
  }
  return "customer";
};

export const verifyAuthToken = async (
  token: string
): Promise<AuthUser | null> => {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, neonJWKS, {
      issuer: env.NEON_AUTH_BASE_URL,
      audience: env.NEON_AUTH_BASE_URL,
    });

    const userId = claimString(payload.sub);
    if (!userId) {
      return null;
    }

    const tokenEmail = claimString(payload.email).toLowerCase();
    const tokenName = claimString(payload.name);
    const tokenRole = claimString(payload.role);

    const user = await findNeonUser({
      id: userId,
      ...(tokenEmail ? { email: tokenEmail } : {}),
    });

    const effectiveId = user?.id || userId;
    const effectiveEmail = user?.email || tokenEmail;
    const effectiveName =
      user?.name?.trim() || tokenName || effectiveEmail.split("@")[0] || "User";

    const store = await prisma.stores.findFirst({
      where: {
        merchant_id: effectiveId,
      },
      orderBy: {
        id: "asc",
      },
    });

    return {
      id: effectiveId,
      name: effectiveName,
      email: effectiveEmail,
      role: resolveRole(user?.role, tokenRole, store !== null),
      store_id: store?.id ?? null,
    };
  } catch (error) {
    console.error("Error verifying Neon auth token", error);
    return null;
  }
};

const readBearerToken = (authorization: string | undefined): string | null => {
  if (!authorization) {
    return null;
  }
  return /^Bearer\s+(\S+)$/i.exec(authorization.trim())?.[1] ?? null;
};

export const requireAuth = async (
  req: AuthenicatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = readBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({
      success: false,
      message: "Unauthorized: No token provided",
    });
    return;
  }
  const user = await verifyAuthToken(token);

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token",
    });
    return;
  }
  req.user = user;
  next();
};

export const optionalAuth = async (
  req: AuthenicatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = readBearerToken(req.headers.authorization);
  if (token) {
    const user = await verifyAuthToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
};

export const requireRole = (roles: Array<AuthUser["role"]>) => {
  return (
    req: AuthenicatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No token provided",
      });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Forbidden: Access Denied",
      });
      return;
    }
    next();
  };
};
