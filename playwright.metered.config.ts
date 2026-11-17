import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: '**/metered.spec.ts', testIgnore: [],
  webServer: [
    { command: 'node node_modules/vite/bin/vite.js --mode e2e', url: 'http://localhost:3000', reuseExistingServer: false,
      env: { VITE_CALL_ENGINE: 'metered', VITE_TEST_SIGNAL_URL: 'ws://localhost:19117' } },
    { command: 'node tests/metered-signaling.cjs', port: 19117, reuseExistingServer: false },
  ],
});
