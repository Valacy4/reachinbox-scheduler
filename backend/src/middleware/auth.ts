import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface AuthedRequest extends Request {
  user?: { email: string; name: string; picture?: string };
}

/**
 * Stub middleware - not yet applied to any route.
 * Once the frontend (hour 26-34, NextAuth Google provider) sends its ID
 * token as `Authorization: Bearer <idToken>`, protect a route with:
 *   router.use(requireGoogleAuth)
 * or apply it per-route: router.get("/scheduled", requireGoogleAuth, getScheduledEmails)
 */
export async function requireGoogleAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization: Bearer <idToken> header" });
  }

  const idToken = header.slice("Bearer ".length);

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ error: "Invalid token payload" });
    }
    req.user = { email: payload.email, name: payload.name ?? "", picture: payload.picture };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired Google ID token" });
  }
}