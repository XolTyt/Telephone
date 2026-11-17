import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const deployed = process.env.CLEARCALL_URL;
export default defineConfig({
  ...base, testDir:'./tests/cloud', testMatch:'**/*.spec.ts', testIgnore:[], timeout:90000,
  use:{...base.use, baseURL:deployed || 'http://localhost:3000'},
  webServer:deployed ? undefined : { command:'node node_modules/vite/bin/vite.js --mode e2e', url:'http://localhost:3000', reuseExistingServer:false, env:{VITE_CALL_ENGINE:'metered',VITE_TEST_SIGNAL_URL:''} },
});
