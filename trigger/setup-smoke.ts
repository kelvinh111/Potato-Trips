import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

const setupSmokePayloadSchema = z.object({
  message: z.string(),
});

export const setupSmokeTask = schemaTask({
  id: "setup-smoke",
  schema: setupSmokePayloadSchema,
  run: async (payload) => {
    return {
      ok: true as const,
      message: payload.message,
    };
  },
});
