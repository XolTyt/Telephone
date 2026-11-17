import { test, expect } from '@playwright/test';

test('two phone-sized browsers exchange real WebRTC media and reconnect', async ({ context, page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Создать комнату' }).click();
  await expect(page.getByText('Ожидаем второй телефон')).toBeVisible();
  const room = await page.locator('.room-link.font-mono').innerText();
  const guest = await context.newPage();
  guest.on('pageerror', error => errors.push(error.message));
  await guest.goto(`/?room=${room}`);
  await expect(guest.getByLabel('Код комнаты')).toHaveValue(room);
  await guest.getByRole('button', { name: 'Войти в звонок' }).click();
  for (const phone of [page, guest]) {
    await expect.poll(() => phone.locator('.remote-video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30000 }).toBeGreaterThan(0);
    expect(await phone.locator('.remote-video').evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).getAudioTracks().some(t => t.readyState === 'live'))).toBe(true);
    await expect(phone.getByLabel('Статистика качества')).toContainText('Приём:', { timeout: 10000 });
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Выключить микрофон' }).click();
  await page.getByRole('button', { name: 'Переключить камеру' }).click();
  await expect(page.getByRole('button', { name: 'Переключить камеру' })).toBeEnabled();
  expect(await page.locator('.local-video').evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).getAudioTracks()[0].enabled)).toBe(false);
  await page.getByRole('button', { name: 'Выключить камеру' }).click();
  await page.getByRole('button', { name: 'Включить камеру' }).click();
  await page.screenshot({ path: 'tests/artifacts/phone-call.png' });
  await guest.getByRole('button', { name: 'Переподключиться', exact: true }).click();
  await expect.poll(() => guest.locator('.remote-video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 40000 }).toBeGreaterThan(0);
  await guest.getByRole('button', { name: 'Завершить звонок' }).click();
  await expect(guest.getByRole('heading', { name: 'ClearCall', exact: true })).toBeVisible();
  // A remote browser closing can be detected through ICE rather than a close message:
  // allow time for ICE detection plus the app's 10-second reconnection grace period.
  await expect(page.getByText('Ожидаем второй телефон')).toBeVisible({ timeout: 30000 });
  await guest.goto(`/?room=${room}`);
  await guest.getByRole('button', { name: 'Войти в звонок' }).click();
  await expect.poll(() => guest.locator('.remote-video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
