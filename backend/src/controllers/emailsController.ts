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
  const statusParam = req.query.status as string | undefined;
  const searchParam = req.query.search as string | undefined;

  const whereClause: any = {
    status: statusParam && statusParam !== "all"
      ? statusParam
      : { in: [...SCHEDULED_STATUSES] },
  };

  if (searchParam) {
    whereClause.OR = [
      { recipient: { contains: searchParam, mode: "insensitive" } },
      { subject: { contains: searchParam, mode: "insensitive" } },
    ];
  }

  const [jobs, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: { sender: { select: { email: true } } },
    }),
    prisma.emailJob.count({ where: whereClause }),
  ]);

  res.json({
    total,
    limit,
    offset,
    jobs: jobs.map((j: (typeof jobs)[number]) => ({
      id: j.id,
      recipient: j.recipient,
      subject: j.subject,
      body: j.body,
      batchId: j.batchId,
      scheduledAt: j.scheduledAt,
      status: j.status,
      sender: j.sender.email,
    })),
  });
}

export async function getSentEmails(req: Request, res: Response) {
  const { limit, offset } = parsePagination(req);
  const statusParam = req.query.status as string | undefined;
  const searchParam = req.query.search as string | undefined;

  const whereClause: any = {
    status: statusParam && statusParam !== "all"
      ? statusParam
      : { in: [...TERMINAL_STATUSES] },
  };

  if (searchParam) {
    whereClause.OR = [
      { recipient: { contains: searchParam, mode: "insensitive" } },
      { subject: { contains: searchParam, mode: "insensitive" } },
    ];
  }

  const [jobs, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: { sender: { select: { email: true } } },
    }),
    prisma.emailJob.count({ where: whereClause }),
  ]);

  res.json({
    total,
    limit,
    offset,
    jobs: jobs.map((j: (typeof jobs)[number]) => ({
      id: j.id,
      recipient: j.recipient,
      subject: j.subject,
      body: j.body,
      batchId: j.batchId,
      sentAt: j.sentAt,
      status: j.status,
      lastError: j.lastError,
      previewUrl: j.previewUrl,
      sender: j.sender.email,
    })),
  });
}