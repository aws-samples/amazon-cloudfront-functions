import cf from 'cloudfront';
import crypto from 'crypto';

// Viewer response function.
// The viewer response event runs on every response, cache hits included, so a network
// call here must be rare by construction: this function fires a "served" event with
// cf.beacon only for a sample of requests, chosen from a hash of the request id.
// Everything else gets x-signal-served: skipped and no call.
// The sample is a hash, not Math.random(): a function cannot make a network call after
// it has generated random values.

// The origin id (the origin's Name in the console) of the event collector on this distribution.
const SIGNAL_ORIGIN_ID = 'signal-collector';
const SIGNAL_PATH = '/signal';
// Share of responses that send a "served" event, in percent.
const SAMPLE_PERCENT = 1;
const MAX_SIGNAL_ID_LENGTH = 128; // fits an SQS FIFO deduplication id
const SIGNAL_ID_HEADER = 'x-signal-id';
const SERVED_HEADER = 'x-signal-served';
const ERROR_HEADER = 'x-signal-served-error';

function headerValue(headers, name) {
    return headers[name] ? headers[name].value : '';
}

// The first 16 bits of SHA-256(request id), as a share of 65536.
function sampled(requestId) {
    if (!requestId) {
        return false;
    }
    const bucket = parseInt(crypto.createHash('sha256').update(requestId).digest('hex').slice(0, 4), 16);
    return bucket < (SAMPLE_PERCENT / 100) * 65536;
}

function servedSignal(request, status) {
    const uri = request.uri.slice(0, MAX_SIGNAL_ID_LENGTH);
    return {
        kind: 'served',
        uri: uri,
        status: status,
        // Correlates with the "requested" event that index.js sent on the way in.
        signalId: headerValue(request.headers, SIGNAL_ID_HEADER) || uri,
        // Its own deduplication id, so it never collapses into the "requested" event.
        dedupId: ('served:' + uri + ':' + status).slice(0, MAX_SIGNAL_ID_LENGTH),
        ts: Date.now(),
    };
}

async function handler(event) {
    const request = event.request;
    const response = event.response;

    if (!sampled(event.context.requestId)) {
        response.headers[SERVED_HEADER] = { value: 'skipped' };
        return response;
    }

    try {
        cf.beacon(SIGNAL_PATH, {
            originId: SIGNAL_ORIGIN_ID,
            method: 'POST',
            headers: { 'content-type': 'application/json' }, // plain strings, not { value } objects
            body: JSON.stringify(servedSignal(request, response.statusCode)),
            logDeliveryErrors: true, // a delivery failure after the function returned goes to CloudWatch Logs
        });
        response.headers[SERVED_HEADER] = { value: 'beacon' };
    } catch (error) {
        response.headers[SERVED_HEADER] = { value: 'failed' };
        response.headers[ERROR_HEADER] = { value: error.name + ': ' + error.message };
    }
    return response;
}
