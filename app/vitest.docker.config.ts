import { defineConfig } from "vitest/config";
// Docker-Integrationstests (Compose-Projekt planora-a, Host-Ports 18080/18443). Aufruf: npm run test:docker
// Die Dateien pruefen PLANORA_DOCKER_TESTS und ueberspringen sich im normalen `npm test` selbst.
export default defineConfig({
  test: {
    include: ["test-docker/**/*.test.ts"], env: { PLANORA_DOCKER_TESTS: "1" },
    testTimeout: 600_000, hookTimeout: 900_000, fileParallelism: false, maxWorkers: 1,
  },
});
