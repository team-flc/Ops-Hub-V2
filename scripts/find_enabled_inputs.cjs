const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3500));
  await page.goto('https://ops.faseehlall.com/clients/8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3?preview=true', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Client Details'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  const inputs = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('main input, form input'));
    return list.map(i => ({
      name: i.name,
      id: i.id,
      placeholder: i.placeholder,
      value: i.value,
      type: i.type,
      outerHTML: i.outerHTML,
      disabled: i.disabled
    })).filter(i => !i.disabled);
  });
  console.log('Maven Enabled inputs:', JSON.stringify(inputs, null, 2));
  await browser.close();
})();
