// =============================================================================
// vitest.config.ts — BlockLand Zimbabwe Test Configuration
// =============================================================================
//
// Configures Vitest to work with the Clarinet v2 simnet environment.
//
// Key settings:
//   - pool: 'forks'     — Required for Clarinet simnet WASM isolation.
//                         Each test file gets a fresh OS process, preventing
//                         simnet state from leaking between test files.
//   - singleThread: true — Runs tests sequentially within a file.
//                          Blockchain state is sequential — parallel tests
//                          would produce non-deterministic block heights.
//   - testTimeout       — Blockchain simnet calls can be slower than pure JS.
//                          15 seconds is generous but safe for all test paths.
//
// =============================================================================

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use 'forks' pool so each test file gets isolated simnet state.
    // Without this, WASM memory from @hirosystems/clarinet-sdk can leak.
    pool: "forks",

    // Run tests sequentially within a file.
    // Blockchain state (block height, map contents) must be deterministic.
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Give each individual test up to 15 seconds.
    // initSimnet() loads WASM — the first test in a file may be slower.
    testTimeout: 15_000,

    // Coverage configuration — run with: npm test -- --coverage
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
