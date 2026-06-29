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
        '**/*.d.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
