import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { scheduleRouter } from "./routes/scheduleRoutes";
import { emailsRouter } from "./routes/emailsRoutes";
import { uploadRouter } from "./routes/uploadRoutes";
import { requireGoogleAuth } from "./middleware/auth";
import { reconcilePendingJobs } from "./jobs/reconcile";

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "unreachable" });
  }
});

app.use("/api/schedule", requireGoogleAuth, scheduleRouter);
app.use("/api/emails", requireGoogleAuth, emailsRouter);
app.use("/api/uploads", requireGoogleAuth, uploadRouter);

app.listen(env.port, async () => {
  console.log(`API listening on http://localhost:${env.port}`);
  await reconcilePendingJobs();
});