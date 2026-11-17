import { test, expect } from '@playwright/test';
const transports = process.env.CLEARCALL_FORCE_RELAY === '0' ? ['direct'] : ['relay', 'tls'];
for (const transport of transports) {
  test(`real Metered Cloud passes audio/video over ${transport}`, async ({ context, page }) => {
    const key = process.env.METERED_PUBLISHABLE_KEY;
    test.skip(!process.env.CLEARCALL_URL && !key, 'A real publishable key or configured deployment is required.');
    if (!process.env.CLEARCALL_URL) {
      await context.route('**/api/call-config', route => route.fulfill({ contentType:'application/json', body:JSON.stringify({apiKey:key,version:'cloud-test'}) }));
    }
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{writeText:async(url:string) => { (window as unknown as {sharedUrl?:string}).sharedUrl=url; }} });
      const Native = window.RTCPeerConnection;
      const connections: RTCPeerConnection[] = [];
      window.RTCPeerConnection = class extends Native {
        constructor(config?:RTCConfiguration) { super(config); connections.push(this); }
      };
      (window as unknown as { testConnections:RTCPeerConnection[] }).testConnections=connections;
    });
    const relay = transport === 'tls' ? 'tls' : '1';
    await page.goto(transport === 'direct' ? '/' : `/?relay=${relay}`);
    await page.getByRole('button',{name:'Создать звонок'}).click();
    await expect(page.getByRole('button',{name:'Скопировать ссылку'})).toBeVisible({timeout:30000});
    await page.getByRole('button',{name:'Скопировать ссылку'}).click();
    const link=await page.evaluate(()=>(window as unknown as {sharedUrl:string}).sharedUrl);
    const guest=await context.newPage(); const guestUrl=new URL(link);
    if(transport!=='direct')guestUrl.searchParams.set('relay',relay);
    await guest.goto(guestUrl.href); await guest.getByRole('button',{name:'Войти в звонок'}).click();
    await page.getByRole('button',{name:'60 FPS'}).click();
    await expect(page.getByRole('button',{name:'60 FPS ✓'})).toBeEnabled();
    await expect.poll(()=>page.evaluate(()=>
      (window as unknown as {testConnections:RTCPeerConnection[]}).testConnections
        .flatMap(pc=>pc.getSenders()).filter(sender=>sender.track?.kind==='video')
        .some(sender=>sender.getParameters().encodings.some(e=>e.maxFramerate===60 && e.maxBitrate===12000000))
    )).toBe(true);
    for (const phone of [page,guest]) {
      await expect.poll(()=>phone.locator('.remote-video').evaluate((v:HTMLVideoElement)=>v.videoWidth),{timeout:45000}).toBeGreaterThanOrEqual(1920);
      await expect.poll(()=>phone.locator('.remote-video').evaluate((v:HTMLVideoElement)=>v.videoHeight),{timeout:15000}).toBeGreaterThanOrEqual(1080);
      await expect.poll(()=>phone.evaluate(async()=>{
        let packets=0;
        for(const pc of (window as unknown as {testConnections:RTCPeerConnection[]}).testConnections) {
          if(pc.connectionState!=='connected')continue;
          (await pc.getStats()).forEach(s=>{if(s.type==='inbound-rtp'&&(s.kind==='audio'||s.mediaType==='audio'))packets+=s.packetsReceived??0;});
        }
        return packets;
      }),{timeout:10000}).toBeGreaterThan(0);
      await phone.locator('summary').click();
      await expect(phone.getByLabel('Статистика качества')).toContainText(transport==='direct'?'Приём:':'Через TURN',{timeout:15000});
      if(transport!=='direct')await expect(phone.getByText('TURN получен от сервиса',{exact:true})).toBeVisible();
    }
    await page.screenshot({path:`tests/artifacts/cloud-${transport}-call.png`});
    await guest.getByRole('button',{name:'Завершить звонок'}).click(); await page.getByRole('button',{name:'Завершить звонок'}).click();
  });
}
