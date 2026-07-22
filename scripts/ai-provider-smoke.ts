import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { AiProviderError } from "../lib/ai/errors";
import { getAiProvider } from "../lib/ai/provider";

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });

async function main() {
  const provider = getAiProvider();

  const result = await provider.generateStructured({
    systemInstructions:
      "You output concise structured data for travel-planning diagnostics.",
    prompt: "Return one short travel mood word.",
    outputSchema: z.object({
      mood: z.string().min(1).max(24),
    }),
  });

  console.log("AI smoke output:", result.output);
  console.log("AI smoke model:", result.model);
  console.log("AI smoke usage:", result.usage);
}

main().catch((error: unknown) => {
  if (error instanceof AiProviderError) {
    console.error("AI smoke failed:", {
      code: error.code,
      message: error.message,
    });
    process.exit(1);
  }

  console.error("AI smoke failed with unexpected error.");
  process.exit(1);
});
