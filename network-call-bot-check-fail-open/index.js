import cf from 'cloudfront';

// Viewer request function.
// Two lookups run in parallel:
//   1. One network call: POST /check on a bot-detection service on this distribution.
//      The only latency limit is the runtime's fixed 1 s timeout.
//   2. A KeyValueStore read of the key bot-policy: block | tag | off. No KVS or no key -> tag.
// Service slow or broken -> forward with x-bot-check: unavailable (fail open).
// Verdict bot + block    -> 403 block page.
// Verdict bot + tag      -> forward with x-bot-verdict: bot; the origin decides.
// Policy off             -> forward, verdict ignored.

// The origin id (the origin's Name in the console) of the bot-detection service on this distribution.
const VENDOR_ORIGIN_ID = 'bot-check';
const CHECK_PATH = '/check';
const BOT_POLICY_KEY = 'bot-policy';
const POLICIES = ['block', 'tag', 'off'];
const DEFAULT_POLICY = 'tag';
// Every header this function sets starts with this prefix; viewer-supplied ones are deleted.
const BOT_HEADER_PREFIX = 'x-bot-';
const POLICY_HEADER = 'x-bot-policy';
const POLICY_SOURCE_HEADER = 'x-bot-policy-source';
const CHECK_HEADER = 'x-bot-check';
const VERDICT_HEADER = 'x-bot-verdict';
const SCORE_HEADER = 'x-bot-score';
const ERROR_HEADER = 'x-bot-check-error';

function headerValue(request, name) {
    return request.headers[name] ? request.headers[name].value : '';
}

function describeError(error) {
    return error.name + ': ' + error.message;
}

// Never trust verdict headers coming from the viewer.
function stripBotHeaders(headers) {
    for (const name in headers) {
        if (name.indexOf(BOT_HEADER_PREFIX) === 0) {
            delete headers[name];
        }
    }
}

// The one network call. Resolves to { verdict, score } or throws.
async function askVendor(request, viewer) {
    const body = JSON.stringify({
        path: request.uri,
        ip: viewer.ip,
        userAgent: headerValue(request, 'user-agent'),
        acceptLanguage: headerValue(request, 'accept-language'),
    });
    const vendorResponse = await cf.fetch(CHECK_PATH, {
        originId: VENDOR_ORIGIN_ID,
        method: 'POST',
        headers: { 'content-type': 'application/json' }, // plain strings, not { value } objects
        body: body,
        includeBody: true, // default false; the verdict is in the body
    });
    if (!vendorResponse.ok) {
        throw new Error('vendor returned ' + vendorResponse.status);
    }
    const text = await vendorResponse.text(); // assign first: no await inside call arguments
    const answer = JSON.parse(text);
    if (answer.verdict !== 'bot' && answer.verdict !== 'human') {
        throw new Error('vendor verdict unreadable');
    }
    return { verdict: answer.verdict, score: Number(answer.score) || 0 };
}

// Rejects when no KVS is associated, the key is missing or the value is unknown.
async function readPolicy() {
    const value = await cf.kvs().get(BOT_POLICY_KEY);
    const policy = String(value).trim().toLowerCase();
    if (POLICIES.indexOf(policy) === -1) {
        throw new Error(BOT_POLICY_KEY + ' "' + policy + '" is not block|tag|off');
    }
    return policy;
}

function blockPage(check) {
    const headers = {
        'content-type': { value: 'text/html; charset=utf-8' },
        'cache-control': { value: 'no-store' },
    };
    headers[VERDICT_HEADER] = { value: 'bot' };
    headers[SCORE_HEADER] = { value: String(check.score) };
    return {
        statusCode: 403,
        statusDescription: 'Forbidden',
        headers: headers,
        body: '<!doctype html><title>Blocked</title><h1>403 Blocked</h1>',
    };
}

async function handler(event) {
    const request = event.request;
    const headers = request.headers;
    stripBotHeaders(headers);

    // allSettled, not all: a missing KVS key must not throw away the vendor verdict.
    const results = await Promise.allSettled([askVendor(request, event.viewer), readPolicy()]);
    const vendorResult = results[0];
    const policyResult = results[1];

    const fromKvs = policyResult.status === 'fulfilled';
    const policy = fromKvs ? policyResult.value : DEFAULT_POLICY;
    headers[POLICY_HEADER] = { value: policy };
    headers[POLICY_SOURCE_HEADER] = { value: fromKvs ? 'kvs' : 'default: ' + describeError(policyResult.reason) };

    if (vendorResult.status === 'rejected') {
        // Fail open: TypeError, TimeoutError, InternalError, a bad status or an unreadable verdict.
        headers[CHECK_HEADER] = { value: 'unavailable' };
        headers[ERROR_HEADER] = { value: describeError(vendorResult.reason) };
        return request;
    }

    const check = vendorResult.value;
    headers[CHECK_HEADER] = { value: 'ok' };
    if (policy === 'off') {
        return request;
    }

    headers[VERDICT_HEADER] = { value: check.verdict };
    headers[SCORE_HEADER] = { value: String(check.score) };
    if (check.verdict === 'bot' && policy === 'block') {
        return blockPage(check);
    }
    return request;
}
