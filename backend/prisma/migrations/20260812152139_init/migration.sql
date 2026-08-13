-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'queued', 'delayed', 'sending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "Sender" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "smtpUser" TEXT NOT NULL,
    "smtpPass" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "delayMs" INTEGER NOT NULL DEFAULT 0,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "bullmqJobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sender_email_key" ON "Sender"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailJob_bullmqJobId_key" ON "EmailJob"("bullmqJobId");

-- CreateIndex
CREATE INDEX "EmailJob_status_idx" ON "EmailJob"("status");

-- CreateIndex
CREATE INDEX "EmailJob_scheduledAt_idx" ON "EmailJob"("scheduledAt");

-- CreateIndex
CREATE INDEX "EmailJob_senderId_sentAt_idx" ON "EmailJob"("senderId", "sentAt");

-- CreateIndex
CREATE INDEX "EmailJob_batchId_idx" ON "EmailJob"("batchId");

-- AddForeignKey
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Sender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
