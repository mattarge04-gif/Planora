import { defineConfig } from "vitest/config";
export default defineConfig({ test: { globalSetup: ["./test/globalSetup.ts"], testTimeout: 30000, hookTimeout: 60000, fileParallelism: false } });
