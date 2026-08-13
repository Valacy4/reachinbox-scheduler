import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const SCHEDULED_STATUSES = ["pending", "queued", "delayed", "sending"] as const;
const TERMINAL_STATUSES = ["sent", "failed"] as const;

function parsePagination(req: Request) {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10) || 50, 200);
  const offset = Math.max(parseInt((req.query.offset as string) ?? "0", 10) || 0, 0);
  return { limit, offset };
}

export async function getScheduledEmails(req: Request, res: Response) {
  const { limit, offset } = parsePagination(req);

  const [jobs, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: { status: { in: [...SCHEDULED_STATUSES] } },
      orderBy: { scheduledAt: "asc" },
      take: limit,
      skip: offset,
      include: { sender: { select: { email: true } } },
    }),
    prisma.emailJob.count({ where: { status: { in: [...SCHEDULED_STATUSES] } } }),
  ]);

  res.json({
    total,
    limit,
    offset,
    jobs: jobs.map((j: (typeof jobs)[number]) => ({
      id: j.id,
      recipient: j.recipient,
      subject: j.subject,
      scheduledAt: j.scheduledAt,
      status: j.status,
      sender: j.sender.email,
    })),
  });
}

export async function getSentEmails(req: Request, res: Response) {
  const { limit, offset } = parsePagination(req);

  const [jobs, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: { status: { in: [...TERMINAL_STATUSES] } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: { sender: { select: { email: true } } },
    }),
    prisma.emailJob.count({ where: { status: { in: [...TERMINAL_STATUSES] } } }),
  ]);

  res.json({
    total,
    limit,
    offset,
    jobs: jobs.map((j: (typeof jobs)[number]) => ({
      id: j.id,
      recipient: j.recipient,
      subject: j.subject,
      sentAt: j.sentAt,
      status: j.status,
      lastError: j.lastError,
      sender: j.sender.email,
    })),
  });
}