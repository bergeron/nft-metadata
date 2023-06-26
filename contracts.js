const fs = require("fs");
const util = require("./util.js");

// This file gets NFT contracts on ETH mainnet
(async function main() {
    let resp = null;
    do {
        let url = "https://api.reservoir.tools/collections/v5";
        if (resp?.continuation) url += `?continuation=${resp?.continuation}`;

        resp = JSON.parse(await util.retry(() =>
            util.get(url, {'x-api-key': process.env.RESERVOIR_KEY}),
            error => error?.code == 429 || error?.code >= 500));

        for (const collection of resp?.collections ?? []) {
            fs.writeFileSync(
                `contracts/${collection.primaryContract}.json`,
                JSON.stringify({
                    address: collection.primaryContract,
                    type: collection.contractKind.toUpperCase(),
                    name: collection.name,
                    tokenCount: collection.tokenCount
                }, null, 2)
            );
        }
    } while (resp?.continuation != null && resp?.collections?.length > 0);
})().catch(e => { console.error(e); process.exitCode = 1; });
