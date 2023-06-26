const { Web3 } = require('web3');
const fs = require("fs");
const util = require("./util.js");
const cluster = require("cluster")

// This file gets NFT metadata for the contracts in ./contracts.
// Only token id 1 is fetched as a representitive sample of each contract's metadata format.

// Spawn worker processes for parallelization
if (cluster.isPrimary) {
    for (let i=0; i < 16 ; i++) cluster.fork();
    return;
}

(async function main() {
    const web3 = new Web3(new Web3.providers.HttpProvider("https://cloudflare-eth.com"));

    const erc721Abi = [{
        "name": "tokenURI", "type": "function", "stateMutability": "view",
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    }];

    const erc1155Abi = [{
        "name": "uri", "type": "function",  "stateMutability": "view",
        "inputs": [ { "internalType": "uint256", "name": "id", "type": "uint256" } ],
        "outputs": [ { "internalType": "string", "name": "", "type": "string" } ]}
    ];

    // For each NFT contract
    for (const file of fs.readdirSync("./contracts")) {

        // If I'm the worker that's supposed to process it.
        // worker 0 processes contracts that start with 0x0
        // worker 1 processes contracts that start with 0x1
        // ...
        if (file[2] != (cluster.worker.id-1).toString(16)) continue;

        // And we don't already have metadata from a previous run
        if (fs.existsSync(`./metadata/${file}`)) continue;

        // Then get the metadata URI from RPC
        let uri;
        const contract = JSON.parse(fs.readFileSync(`./contracts/${file}`));
        if (contract.type == "ERC721") {
            const abi = new web3.eth.Contract(erc721Abi, contract.address);
            try { uri = await abi.methods.tokenURI(1).call() }
            catch { } // Best effort only
        } else if (contract.type == "ERC1155") {
            const abi = new web3.eth.Contract(erc1155Abi, contract.address);
            try { uri = (await abi.methods.uri(1).call()).replaceAll("{id}", "1") }
            catch { } // Best effort only
        }

        // Get the actual metadata from the URI
        if (uri) {
            let metadata;
            try { metadata = await getMetadata(uri); }
            catch(e) {
                console.error({
                    message: "Failed to get metadata",
                    contractAddress: contract.address,
                    tokenId: 1, uri: uri, error: e
                });
            }

            try { metadata = JSON.parse(metadata) }
            catch { } // Might not be valid JSON

            if (metadata) {
                fs.writeFileSync(
                    `metadata/${contract.address}.json`,
                    JSON.stringify({...contract, uri: uri, metadata: metadata}, null, 2)
                )
            }
        }
    }
})().catch(e => { console.error(e); process.exitCode = 1; });

async function getMetadata(uri) {
    uri = uri.trim();
    
    // For IPFS, substitute a specific gateway
    if (uri.startsWith("ipfs://")) {
        uri = "https://ipfs.io/ipfs/" + uri.substring(7);
        return await util.retry(() => util.get(uri), e => e?.code == 429);
    }
    // For Arweave, substitute a specific gateway
    else if (uri.startsWith("ar://")) {
        uri = "https://arweave.net/" + uri.substring(5);
        return await util.retry(() => util.get(uri), e => e?.code == 429);
    }
    // Decode base64 JSON
    else if (uri.startsWith("data:application/json;base64,")) {
        return Buffer.from(uri.substring(29), 'base64').toString('ascii');
    }
    // Plaintext JSON
    else if (uri.startsWith("data:application/json;utf8,")) {
        return uri.substring(27);
    } else if (uri.startsWith("data:application/json,")){
        return uri.substring(22);
    }
    // Pinata rate limits aggresively, so swap for a different IPFS gateway
    else if (uri.includes("pinata.cloud/ipfs/")) {
        uri = "https://ipfs.io/ipfs/" + uri.substring(uri.indexOf("pinata.cloud/ipfs/")+18)
        return await util.retry(() => util.get(uri), e => e?.code == 429);
    }
    // GET http/https
    else if (uri.startsWith("http")) {
        return await util.retry(() => util.get(uri), e => e?.code == 429);
    }
    // Unknown
    else { throw "Unknown URI protocol: " + uri }
}
