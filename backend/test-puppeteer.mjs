import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function test() {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    try {
        console.log("Navigating to fastdl.app...");
        await page.goto('https://fastdl.app/en', { waitUntil: 'domcontentloaded' });
        
        console.log("Typing URL...");
        const targetUrl = 'https://www.instagram.com/reel/DbvtfTlq__A/?igsh=bTJrNmtyYXZuM3J4';
        await page.waitForSelector('input[name="url"]');
        await page.type('input[name="url"]', targetUrl);
        
        console.log("Clicking Download...");
        await page.click('button[type="submit"]');
        
        console.log("Waiting for results...");
        await page.waitForSelector('a.button.button--filled.button__download', { timeout: 20000 });
        
        const downloadLink = await page.$eval('a.button.button--filled.button__download', el => el.href);
        console.log("SUCCESS! Download Link:", downloadLink);
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}
test();
