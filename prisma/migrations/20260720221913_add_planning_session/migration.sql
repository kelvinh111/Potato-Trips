-- CreateEnum
CREATE TYPE "PlanningSessionStatus" AS ENUM ('CLARIFYING', 'READY_TO_GENERATE', 'GENERATING', 'GENERATED', 'FAILED');

-- CreateTable
CREATE TABLE "PlanningSession" (
    "id" TEXT NOT NULL,
    "initialPrompt" TEXT NOT NULL,
    "status" "PlanningSessionStatus" NOT NULL DEFAULT 'CLARIFYING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningSession_expiresAt_idx" ON "PlanningSession"("expiresAt");
