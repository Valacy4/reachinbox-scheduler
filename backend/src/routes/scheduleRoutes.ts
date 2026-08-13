import { Router } from "express";
import { postSchedule, getBatch } from "../controllers/scheduleController";

export const scheduleRouter = Router();

scheduleRouter.post("/", postSchedule);
scheduleRouter.get("/:batchId", getBatch);