import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../lib/auth.js";

export interface AuthedRequest extends Request {
  address?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "not authenticated" });
  }
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: "invalid or expired session" });
  }
  req.address = session.address;
  next();
}

// Attaches req.address when a valid session cookie is present, but never
// rejects the request otherwise -- for endpoints that are public but
// personalize their response when the caller happens to be logged in.
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    const session = verifySessionToken(token);
    if (session) req.address = session.address;
  }
  next();
}
