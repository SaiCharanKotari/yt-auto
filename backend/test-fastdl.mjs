async function test() {
    try {
        const targetUrl = 'https://www.instagram.com/reel/C8-0B8yP34D/';
        
        // FastDL usually has an API endpoint or we can POST to their main site.
        // Let's try searching for their API endpoint.
        const response = await fetch('https://fastdl.app/c/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Origin': 'https://fastdl.app',
                'Referer': 'https://fastdl.app/en4'
            },
            body: new URLSearchParams({ url: targetUrl, clear: '1' })
        });
        
        const data = await response.text();
        console.log("Status:", response.status);
        if (data.includes('window.location.href')) {
            console.log("Got a redirect!");
        }
        console.log("Data snippet:", data.substring(0, 500));
        
        // If it's a JSON response, maybe it's in a different endpoint?
        
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
