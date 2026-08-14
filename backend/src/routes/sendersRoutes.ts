import { Router } from "express";
import { listSenders } from "../controllers/sendersController";

export const sendersRouter = Router();

sendersRouter.get("/", listSenders);
