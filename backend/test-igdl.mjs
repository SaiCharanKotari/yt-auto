import { igdl } from '@sasmeee/igdl';

async function test() {
    try {
        const url = 'https://www.instagram.com/reel/C8-0B8yP34D/'; // A random public reel
        const result = await igdl(url);
        console.log("Result:", result);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
