import { Router } from "express";
import multer from "multer";
import { parseRecipients } from "../controllers/uploadController";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const uploadRouter = Router();

uploadRouter.post("/parse-recipients", upload.single("file"), parseRecipients);