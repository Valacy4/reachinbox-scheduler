import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function listSenders(_req: Request, res: Response) {
  const senders = await prisma.sender.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({ senders });
}
