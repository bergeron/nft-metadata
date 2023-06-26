
const fs = require("fs");

// This file gathers statistics about the metadata.
// TODO: Work in progress.
(async function main() {

    let totalSize = 0, ipfsCount = 0, arweaveCount = 0, httpCount = 0, inlineCount = 0;
    for (const file of fs.readdirSync("./metadata")) {
        try {
            const metadata = JSON.parse(fs.readFileSync(`./metadata/${file}`));
            totalSize += metadata.tokenCount * fs.statSync(`./metadata/${file}`).size;

            if (metadata.uri.startsWith("ipfs://")) ipfsCount++;
            if (metadata.uri.startsWith("ar://")) arweaveCount++;
            if (metadata.uri.startsWith("http")) httpCount++;
            if (metadata.uri.startsWith("data:application/json")) inlineCount++;
        } catch { }
    }

    console.log(`totalSize = ${totalSize}`);
    console.log(`ipfsCount = ${ipfsCount}`);
    console.log(`arweaveCount = ${arweaveCount}`);
    console.log(`httpCount = ${httpCount}`);
    console.log(`inlineCount = ${inlineCount}`);

})().catch(e => { console.error(e); process.exitCode = 1; });
