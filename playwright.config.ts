import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, workers: 1,
  testIgnore: ['**/simple.spec.ts', '**/metered.spec.ts'],
  use: {
    baseURL: 'http://localhost:3000', browserName: 'chromium', channel: 'chrome', headless: true,
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
    permissions: ['camera', 'microphone'], viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node node_modules/vite/bin/vite.js --mode e2e', url: 'http://localhost:3000', reuseExistingServer: false,
      env: { VITE_CALL_ENGINE: 'peerjs', VITE_PEER_HOST: 'localhost', VITE_PEER_PORT: '9000', VITE_PEER_SECURE: 'false', VITE_ICE_SERVERS_URL: '', VITE_TURN_URLS: '' } },
    { command: 'node tests/signaling.cjs', port: 9000, reuseExistingServer: false },
  ],
});
