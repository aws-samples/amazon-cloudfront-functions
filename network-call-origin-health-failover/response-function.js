// Viewer response function. No network call.
// CloudFront does not run viewer response functions when the origin answered 400 or
// higher, so this only sees successes and only annotates them:
//   x-served-by: primary    the primary set x-origin: primary
//   x-served-by: secondary  the secondary set x-origin: secondary
//   x-served-by: fallback   no marker: the static mirror answered
//   x-fallback: true        on anything but primary
// It also copies the request function's verdict headers onto the response.
// Compare x-route with x-served-by to tell "the probe decided" from "the origin group failed over".

const ORIGIN_MARKER_HEADER = 'x-origin';
const SERVED_BY_HEADER = 'x-served-by';
const FALLBACK_HEADER = 'x-fallback';
const PRIMARY_MARKER = 'primary';
const SECONDARY_MARKER = 'secondary';
const VERDICT_HEADERS = ['x-route', 'x-health-probe', 'x-health-probe-error', 'x-route-error'];

function servedBy(marker) {
    if (marker === PRIMARY_MARKER) {
        return 'primary';
    }
    if (marker === SECONDARY_MARKER) {
        return 'secondary';
    }
    return 'fallback';
}

function copyVerdictHeaders(requestHeaders, responseHeaders) {
    for (let i = 0; i < VERDICT_HEADERS.length; i++) {
        const header = requestHeaders[VERDICT_HEADERS[i]];
        if (header) {
            responseHeaders[VERDICT_HEADERS[i]] = { value: header.value };
        }
    }
}

function handler(event) {
    const headers = event.response.headers;

    // The marker is internal: read it, then drop it.
    const marker = headers[ORIGIN_MARKER_HEADER] ? headers[ORIGIN_MARKER_HEADER].value : '';
    delete headers[ORIGIN_MARKER_HEADER];
    const origin = servedBy(marker);
    headers[SERVED_BY_HEADER] = { value: origin };
    if (origin !== 'primary') {
        headers[FALLBACK_HEADER] = { value: 'true' };
    }

    copyVerdictHeaders(event.request.headers, headers);
    return event.response;
}
