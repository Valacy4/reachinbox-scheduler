import { Router } from "express";
import { getScheduledEmails, getSentEmails } from "../controllers/emailsController";

export const emailsRouter = Router();

emailsRouter.get("/scheduled", getScheduledEmails);
emailsRouter.get("/sent", getSentEmails);