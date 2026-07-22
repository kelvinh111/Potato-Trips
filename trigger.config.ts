import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_javhjcwwaeqyasaugdzo",
  runtime: "node-22",
  dirs: ["./trigger"],
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
  },
});
