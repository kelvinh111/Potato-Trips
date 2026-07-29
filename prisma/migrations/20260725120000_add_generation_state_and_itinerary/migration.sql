-- CreateEnum
CREATE TYPE "PlanningSessionGenerationPhase" AS ENUM (
  'PREPARING_TRIP',
  'GENERATING_ITINERARY',
  'CHECKING_PLAN',
  'SAVING_ITINERARY'
);

-- AlterTable
ALTER TABLE "PlanningSession"
ADD COLUMN "generatedItinerary" JSONB,
ADD COLUMN "generationPhase" "PlanningSessionGenerationPhase",
ADD COLUMN "generationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "generationError" TEXT;
