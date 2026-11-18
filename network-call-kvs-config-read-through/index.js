import cf from 'cloudfront';

// Viewer request function.
// Read-through config per key (a tenant, an API key, a model route). The key is the first
// path segment: /acme/orders reads the config of acme.
//   fresh KVS entry -> use it, no network call
//   miss or expired -> one call: GET /config/<key> on the config origin
//   call fails      -> the expired KVS entry if there is one, else DEFAULT_CONFIG (fail open)
// The origin counts reads per key, and a job off the request path writes hot keys to KVS,
// so their next reads are KVS hits. The result is forwarded in the x-config-* headers.

// The origin id (the origin's Name in the console) of the config service on this distribution.
const CONFIG_ORIGIN_ID = 'config';
const CONFIG_PATH = '/config/';
const KVS_KEY_PREFIX = 'cfg-'; // the promoter writes {"exp": <epoch seconds>, "config": <object>} under cfg-<key>
const DEFAULT_KEY = 'default';
const KEY_PATTERN = /^[a-z0-9-]{1,32}$/;
const DEFAULT_CONFIG = { plan: 'free', model: 'small', rateLimit: 10 };
const CONFIG_HEADER = 'x-config';
const KEY_HEADER = 'x-config-key';
const SOURCE_HEADER = 'x-config-source';
const HITS_HEADER = 'x-config-hits';
const ERROR_HEADER = 'x-config-error';
const OWN_HEADERS = [CONFIG_HEADER, KEY_HEADER, SOURCE_HEADER, HITS_HEADER, ERROR_HEADER];

function describeError(error) {
    return error.name + ': ' + error.message;
}

// Never trust config headers coming from the viewer: the origin trusts only what this function set.
function stripConfigHeaders(headers) {
    for (let i = 0; i < OWN_HEADERS.length; i++) {
        delete headers[OWN_HEADERS[i]];
    }
}

function badKey() {
    return {
        statusCode: 400,
        statusDescription: 'Bad Request',
        headers: { 'cache-control': { value: 'no-store' } },
        body: 'key must be 1-32 characters of a-z, 0-9 and -',
    };
}

// A missing key, no KVS associated, or a value that is not JSON throws: that is a miss.
async function readCachedEntry(key) {
    try {
        const entry = await cf.kvs().get(KVS_KEY_PREFIX + key, { format: 'json' });
        return entry && entry.config ? entry : null;
    } catch (error) {
        return null;
    }
}

// exp is in epoch seconds, as the promoter writes it.
function isFresh(entry) {
    return entry.exp * 1000 > Date.now();
}

// The one network call, which also counts the read. Resolves to { config, hits, threshold }, or throws.
async function fetchConfig(key) {
    const configResponse = await cf.fetch(CONFIG_PATH + key, {
        originId: CONFIG_ORIGIN_ID,
        includeBody: true, // default false; the config is in the body
    });
    if (!configResponse.ok) {
        throw new Error('origin returned ' + configResponse.status);
    }
    const text = await configResponse.text(); // assign first: no await inside call arguments
    const answer = JSON.parse(text);
    if (!answer.config) {
        throw new Error('no config in the origin response');
    }
    return answer;
}

async function handler(event) {
    const request = event.request;
    const headers = request.headers;
    stripConfigHeaders(headers);

    const key = request.uri.split('/')[1] || DEFAULT_KEY;
    if (!KEY_PATTERN.test(key)) {
        return badKey();
    }

    // KVS first; only a missing or expired entry makes the call.
    const cached = await readCachedEntry(key);
    let config = DEFAULT_CONFIG;
    let source = 'default';
    if (cached && isFresh(cached)) {
        config = cached.config;
        source = 'kvs';
    } else {
        try {
            const fetched = await fetchConfig(key);
            config = fetched.config;
            source = 'origin';
            if (typeof fetched.hits === 'number') {
                headers[HITS_HEADER] = { value: fetched.hits + '/' + fetched.threshold };
            }
        } catch (error) {
            // Fail open: TypeError, TimeoutError, InternalError, a bad status or body. Stale beats default.
            headers[ERROR_HEADER] = { value: describeError(error) };
            if (cached) {
                config = cached.config;
                source = 'kvs-stale';
            }
        }
    }

    headers[KEY_HEADER] = { value: key };
    headers[SOURCE_HEADER] = { value: source };
    headers[CONFIG_HEADER] = { value: JSON.stringify(config) };
    return request;
}
