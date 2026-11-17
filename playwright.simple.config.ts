import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: '**/simple.spec.ts',
  testIgnore: [],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --mode e2e', url: 'http://localhost:3000', reuseExistingServer: false,
    env: { VITE_CALL_ENGINE: 'livekit' },
  },
});
