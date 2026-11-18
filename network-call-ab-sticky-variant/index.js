import cf from 'cloudfront';
import crypto from 'crypto';

// Viewer request function.
// Sticky A/B variant per user: the uid cookie names the user, the KeyValueStore holds the
// warm working set, and an assignment service behind an origin is the source of truth.
//   KVS hit  -> x-ab-variant from KVS, no network call
//   KVS miss -> one call: POST /assign/<uid> on the assignment origin
//   failure  -> x-ab-variant: control and x-ab-error, request still forwarded (fail open)
// This side never sets a cookie: response-function.js turns x-ab-set-uid and
// x-ab-set-variant into Set-Cookie, so stickiness survives cache hits.

// The origin id (the origin's Name in the console) of the assignment service on this distribution.
const ASSIGNER_ORIGIN_ID = 'assigner';
const ASSIGN_PATH = '/assign/';
const UID_COOKIE = 'uid';
const UID_PATTERN = /^[a-f0-9]{16}$/;
const UID_LENGTH = 16;
const VARIANTS = ['A', 'B'];
const FALLBACK_VARIANT = 'control';
// Every header this function sets starts with this prefix; viewer-supplied ones are deleted.
const AB_HEADER_PREFIX = 'x-ab-';
// Read by response-function.js: only this function may set them.
const SET_UID_HEADER = 'x-ab-set-uid';
const SET_VARIANT_HEADER = 'x-ab-set-variant';
// Forwarded to the origin.
const UID_HEADER = 'x-ab-uid';
const NEW_UID_HEADER = 'x-ab-uid-new';
const KVS_HEADER = 'x-ab-kvs';
const VARIANT_HEADER = 'x-ab-variant';
const SOURCE_HEADER = 'x-ab-source';
const ERROR_HEADER = 'x-ab-error';

function describeError(error) {
    return error.name + ': ' + error.message;
}

function isVariant(value) {
    return VARIANTS.indexOf(value) !== -1;
}

// Never trust A/B headers coming from the viewer: the response side turns two of them into cookies.
function stripAbHeaders(headers) {
    for (const name in headers) {
        if (name.indexOf(AB_HEADER_PREFIX) === 0) {
            delete headers[name];
        }
    }
}

// Unique enough per browser. Not Math.random(): a function cannot make a network call
// after generating random values, so it hashes the request id instead.
function newUid(event) {
    const seed = event.context.requestId + event.viewer.ip + Date.now();
    return crypto.createHash('sha256').update(seed).digest('hex').slice(0, UID_LENGTH);
}

// The viewer's uid cookie, or a new uid that the response side will set as a cookie.
function readOrIssueUid(event) {
    const request = event.request;
    const cookie = request.cookies[UID_COOKIE];
    const uid = cookie ? cookie.value : '';
    if (UID_PATTERN.test(uid)) {
        return uid;
    }
    const issued = newUid(event);
    request.cookies[UID_COOKIE] = { value: issued };
    request.headers[NEW_UID_HEADER] = { value: '1' };
    request.headers[SET_UID_HEADER] = { value: issued };
    return issued;
}

// A missing key, or no KVS associated, throws: that is a miss.
async function readVariant(uid, headers) {
    try {
        const variant = await cf.kvs().get(uid);
        headers[KVS_HEADER] = { value: 'hit' };
        return variant;
    } catch (error) {
        headers[KVS_HEADER] = { value: 'miss: ' + error.message };
        return '';
    }
}

// The one network call, on a KVS miss. Resolves to A or B, or throws.
async function assignVariant(uid) {
    const assignResponse = await cf.fetch(ASSIGN_PATH + uid, {
        originId: ASSIGNER_ORIGIN_ID,
        method: 'POST',
        includeBody: true, // default false; the variant is in the body
    });
    if (!assignResponse.ok) {
        throw new Error('assigner returned ' + assignResponse.status);
    }
    const text = await assignResponse.text(); // assign first: no await inside call arguments
    const assignment = JSON.parse(text);
    if (!isVariant(assignment.variant)) {
        throw new Error('assigner variant unreadable');
    }
    return assignment.variant;
}

async function handler(event) {
    const request = event.request;
    const headers = request.headers;
    stripAbHeaders(headers);

    const uid = readOrIssueUid(event);
    headers[UID_HEADER] = { value: uid };

    // 1. KVS first: a hit needs no call.
    let variant = await readVariant(uid, headers);
    let source = 'kvs';

    // 2. Miss: one call to the assigner.
    if (!isVariant(variant)) {
        try {
            variant = await assignVariant(uid);
            source = 'origin';
        } catch (error) {
            // Fail open: TypeError, TimeoutError, InternalError, a bad status or body.
            variant = FALLBACK_VARIANT;
            source = 'fallback';
            headers[ERROR_HEADER] = { value: describeError(error) };
        }
    }

    headers[VARIANT_HEADER] = { value: variant };
    headers[SOURCE_HEADER] = { value: source };
    // control is not an assignment, so it never becomes a cookie.
    if (variant !== FALLBACK_VARIANT) {
        headers[SET_VARIANT_HEADER] = { value: variant };
    }
    return request;
}
