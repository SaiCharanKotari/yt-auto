import fs from 'fs';

async function test() {
    try {
        const url = 'https://media.fastdl.app/get?__sig=aYewM0lmKtV2mHz5YppxFA&__expires=1786180554&uri=https%3A%2F%2Fscontent-iad3-2.cdninstagram.com%2Fo1%2Fv%2Ft2%2Ff2%2Fm86%2FAQPv1gFTdimaXEuMpGfhpyCNlTUNzRgIsj4A7u4_U2SrkAQzJ8-GDw0PGTQcucuFM4kMV32rSA1VefPN2vcN9vaj9guoRyg8-HaCK0s.mp4%3F_nc_cat%3D103%26_nc_sid%3D5e9851%26_nc_ht%3Dscontent-iad3-2.cdninstagram.com%26_nc_ohc%3D3_h8SiOYGpYQ7kNvwFmGCIJ%26efg%3DeyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU1MDQyNDY1OTg2Njk3MiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0NCwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9%26ccb%3D17-1%26vs%3Db0f5e1b1095b08f0%26_nc_vs%3DHBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMTQ1OTY0RTdGQ0JERUYwM0UyNjQ5OERBQTY3NUFBN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzRCNEI4MjgzODUxQkEyOTc3M0RDMTAyMEJEQkI4QzgxX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACa41dHxy4bBBRUCKAJDMywXQEZhR64UeuEYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA%26_nc_gid%3DgcxxE3ezHALxk-jyjYg41g%26_nc_ss%3D7839b%26_nc_zt%3D28%26oh%3D00_AQH-rTmxE34ZeIclkwNGpTwOUlljWQuLiXyeKkXp8KNVmQ%26oe%3D6A781304%26dl%3D1&filename=%E4%BB%8A%E5%A4%9C%E3%80%81V%E3%81%AF%E3%80%8CVogue%20World-%20Hollywood%E3%80%8D%E3%81%A7%E9%96%8B%E5%82%AC%E3%81%95%E3%82%8C%E3%81%9F%E3%83%A9%E3%82%A4%E3%83%96%E3%83%91%E3%83%95%E3%82%A9%E3%83%BC%E3%83%9E%E3%83%B3%E3%82%B9%E3%82%92%E6%A5%BD%E3%81%97%E3%82%80%E3%81%9F%E3%82%81%E3%80%81%E8%A6%B3%E5%AE%A2%E3%81%AE%E4%B8%AD%E3%81%B8%E3%81%A8%E8%B6%B3%E3%82%92%E9%81%8B%E3%81%B3%E3%81%BE%E3%81%97%E3%81%9F%E3%80%82%E8%87%AA%E8%BA%AB%E3%82%82%E3%81%93%E3%82%8C%E3%81%BE%E3%81%A7%E6%95%B0%E3%80%85%E3%81%AE%E5%8D%B0%E8%B1%A1%E7%9A%84%E3%81%AA%E3%83%95%E3%82%A1%E3%83%83%E3%82%B7%E3%83%A7%E3%83%B3%E3%81%A7%E7%9F%A5%E3%82%89%E3%82%8C%E3%82%8B%E5%BD%BC%E3%81%AF%E3%80%81%E3%81%BE%E3%82%8B.mp4&ua=-&referer=https%3A%2F%2Fwww.instagram.com%2F';
        console.log("Fetching...");
        const response = await fetch(url);
        console.log("Status:", response.status);
        if (response.ok) {
            const dest = fs.createWriteStream('test-download.mp4');
            // node fetch doesn't natively have .pipe, so we stream it manually
            // Actually it's easier to just use pipeline from stream
            const { pipeline } = await import('stream/promises');
            await pipeline(response.body, dest);
            console.log("Downloaded successfully to test-download.mp4");
        } else {
            console.log("Failed. Text:", await response.text());
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
