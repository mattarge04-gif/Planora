import { defineConfig } from "vitest/config";
export default defineConfig({ test: { env: { PLANORA_DOCKER_TEST: "b" }, include: ["test-docker/backup*.test.ts"], testTimeout: 180_000, hookTimeout: 300_000, fileParallelism: false } });
