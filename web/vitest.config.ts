import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Keep tests out of the app/ tree — its [cid] route segments are glob
    // metacharacters and confuse test-file discovery.
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
