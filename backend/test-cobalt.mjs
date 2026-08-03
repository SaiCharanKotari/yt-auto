async function test() {
    try {
        const url = 'https://www.instagram.com/reel/C8-0B8yP34D/'; 
        const response = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            body: JSON.stringify({
                url: url
            })
        });
        const data = await response.json();
        console.log("Result:", data);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
