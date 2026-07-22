-- AlterTable
ALTER TABLE "PlanningSession" ADD COLUMN     "clarificationMessages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "planningBrief" JSONB;
