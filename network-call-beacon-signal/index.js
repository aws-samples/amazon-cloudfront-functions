import cf from 'cloudfront';
import crypto from 'crypto';

// Viewer request function.
// Fires one small JSON event at an origin of this distribution with cf.beacon
// (fire-and-forget), then forwards the request whatever happened.
//   x-signal: beacon -> handed off; nothing to await, no answer to read
//   x-signal: failed -> cf.beacon threw (x-signal-error)
// cf.beacon counts as the one network call of this invocation.

// The origin id (the origin's Name in the console) of the event collector on this distribution.
const SIGNAL_ORIGIN_ID = 'signal-collector';
const SIGNAL_PATH = '/signal';
const MAX_SIGNAL_ID_LENGTH = 128; // fits an SQS FIFO deduplication id
const MAX_USER_AGENT_LENGTH = 200;
const VIEWER_HASH_LENGTH = 16;
const SIGNAL_ID_HEADER = 'x-signal-id';
const SIGNAL_HEADER = 'x-signal';
const ERROR_HEADER = 'x-signal-error';

// Never send the raw viewer IP: a truncated hash is enough to tell viewers apart.
function hashViewerIp(ip) {
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, VIEWER_HASH_LENGTH);
}

function requestedSignal(event, signalId) {
    const headers = event.request.headers;
    const userAgent = headers['user-agent'] ? headers['user-agent'].value : '';
    return {
        kind: 'requested',
        uri: signalId,
        ip: hashViewerIp(event.viewer.ip),
        ua: userAgent.slice(0, MAX_USER_AGENT_LENGTH),
        ts: Date.now(),
    };
}

async function handler(event) {
    const request = event.request;

    // Never pass on viewer-supplied copies of the headers this function sets.
    delete request.headers[SIGNAL_ID_HEADER];
    delete request.headers[SIGNAL_HEADER];
    delete request.headers[ERROR_HEADER];

    // The URI is the deduplication id; carried forward so response-function.js can correlate.
    const signalId = request.uri.slice(0, MAX_SIGNAL_ID_LENGTH);
    request.headers[SIGNAL_ID_HEADER] = { value: signalId };

    try {
        cf.beacon(SIGNAL_PATH, {
            originId: SIGNAL_ORIGIN_ID,
            method: 'POST',
            headers: { 'content-type': 'application/json' }, // plain strings, not { value } objects
            body: JSON.stringify(requestedSignal(event, signalId)),
            logDeliveryErrors: true, // a delivery failure after the function returned goes to CloudWatch Logs
        });
        request.headers[SIGNAL_HEADER] = { value: 'beacon' };
    } catch (error) {
        // Only an invalid call throws here (TypeError): a bad option, or a second call in one invocation.
        request.headers[SIGNAL_HEADER] = { value: 'failed' };
        request.headers[ERROR_HEADER] = { value: error.name + ': ' + error.message };
    }
    return request;
}
