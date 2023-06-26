const http = require("http");
const https = require("https");

/** Wraps an HTTP GET request in a promise. Returns the
 *  response body if successful, and {code, message} otherwise. */
function get(url, headers, timeout=60*1000) {
    function _get(url, timeout, resolve, reject) {
        const start = performance.now();
        const module = url.startsWith("https") ? https : http;

        let req;
        try {
            req = module.request(url, {headers, timeout, rejectUnauthorized:false}, res => {
                let body = "";
                res.on("data", chunk => body += chunk);
                res.on("end", () =>
                    // Handle redirects, reducing timeout to avoid infinite loops
                    (res.statusCode == 301 || res.statusCode == 302)
                        ? _get(res.headers.location,
                            timeout-(performance.now()-start), resolve, reject) :
                    res.statusCode < 400
                        ? resolve(body)
                        : reject({url:url, code:res.statusCode, message:body}));
            });
        } catch(e) {
            reject({code:500, message: e});
            return;
        }

        // The request must be destroyed manually on timeout.
        // https://nodejs.org/docs/latest-v18.x/api/http.html#event-timeout
        req.on("timeout", () => {
            req.destroy();
            reject({code:504, message:"Timed out"});
        });
        req.on("error", e => reject({code:e?.code == "ETIMEDOUT" ? 504 : 500, message:e}));
        req.end();
    }
    return new Promise((resolve, reject) => _get(url, timeout, resolve, reject));
}

/** Runs a function and retries errors it throws */
async function retry(func, retriable, delay=1000, mult=2, max=7, jitter=true) {
    try { return await func(); }
    catch (e) {
        if (max === 0 || !retriable(e)) throw e;
        const ms = Math.round(delay * (jitter ? Math.random() * 0.2 + 0.9 : 1));
        console.warn('Retrying error', {error: e, delayMs: ms, retriesLeft: max ? max-1 : null});
        await new Promise(r => setTimeout(r, ms));
        return retry(func, retriable, delay * mult, mult, max ? max - 1 : null, jitter);
    }
  }

module.exports = {get, retry};
