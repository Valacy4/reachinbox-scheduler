import { Request, Response } from "express";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export async function parseRecipients(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded (field name must be 'file')" });
  }

  const text = file.buffer.toString("utf-8");
  const matches = text.match(EMAIL_REGEX) ?? [];
  const unique = Array.from(new Set(matches.map((e) => e.toLowerCase())));

  return res.json({
    filename: file.originalname,
    count: unique.length,
    emails: unique,
  });
}