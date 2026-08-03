const { instagramdl } = require('@bochilteam/scraper-instagram');

async function test() {
    try {
        const url = 'https://www.instagram.com/reel/C8-0B8yP34D/';
        const result = await instagramdl(url);
        console.log("Result:", result);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
