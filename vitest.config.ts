import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',           // bootstrap exercised via integration only
        'src/scripts/setup.ts',   // interactive readline; not unit-testable
        'src/scripts/diagnose.ts',// CLI script; covered via build artifact run
        'src/utils/logger.ts',    // winston config; no branching logic to cover
        '**/*.d.ts',
      ],
      // Thresholds calibrated against the current 249-test suite. The dispatch
      // layer (src/tools/index.ts) and oauth refresh paths are partially covered
      // by integration but pull function/branch numbers down. Raised on a
      // separate ticket as new tests land.
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 50,
        lines: 50,
      },
    },
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
