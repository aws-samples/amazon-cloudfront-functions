// Viewer response function. No network call, no KVS read.
// The request function decided (KVS first, one cf.fetch on a miss) and left the decision
// on the request as x-ab-set-uid and x-ab-set-variant. This side only turns those into
// cookies. It runs on cache hits too, so it must stay cheap. Both values are checked again.

const SET_UID_HEADER = 'x-ab-set-uid';
const SET_VARIANT_HEADER = 'x-ab-set-variant';
const UID_COOKIE = 'uid';
const VARIANT_COOKIE = 'ab';
const UID_PATTERN = /^[a-f0-9]{16}$/;
const VARIANTS = ['A', 'B'];
const COOKIE_ATTRIBUTES = 'Path=/; Max-Age=86400; Secure; HttpOnly; SameSite=Lax';

function headerValue(headers, name) {
    return headers[name] ? headers[name].value : '';
}

function handler(event) {
    const requestHeaders = event.request.headers;
    const response = event.response;
    const uid = headerValue(requestHeaders, SET_UID_HEADER);
    const variant = headerValue(requestHeaders, SET_VARIANT_HEADER);

    if (UID_PATTERN.test(uid)) {
        response.cookies[UID_COOKIE] = { value: uid, attributes: COOKIE_ATTRIBUTES };
    }
    if (VARIANTS.indexOf(variant) !== -1) {
        response.cookies[VARIANT_COOKIE] = { value: variant, attributes: COOKIE_ATTRIBUTES };
    }
    return response;
}
