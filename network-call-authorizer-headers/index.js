import cf from 'cloudfront';

// Viewer request function.
// A Lambda authorizer with context, at the edge: one network call POSTs the viewer context
// to an authorizer on this distribution, the authorizer answers { allow, headers }, and the
// function copies the allowed identity headers onto the request (allow) or answers 403 (deny).
// An authorizer that cannot be asked fails closed with 503.

// The origin id (the origin's Name in the console) of the authorizer on this distribution.
const AUTHORIZER_ORIGIN_ID = 'authorizer';
const AUTHORIZE_PATH = '/authorize';
// The only headers the authorizer may set. Viewer-supplied copies are always deleted.
const IDENTITY_HEADERS = ['x-tenant', 'x-role'];
// The viewer headers sent to the authorizer.
const FORWARDED_HEADERS = ['authorization', 'user-agent'];
const ERROR_HEADER = 'x-authorizer-error';
const STATUS_TEXT = { 401: 'Unauthorized', 403: 'Forbidden', 503: 'Service Unavailable' };

function headerValue(headers, name) {
    return headers[name] ? headers[name].value : '';
}

// Never trust identity headers coming from the viewer.
function stripIdentityHeaders(headers) {
    for (let i = 0; i < IDENTITY_HEADERS.length; i++) {
        delete headers[IDENTITY_HEADERS[i]];
    }
}

// What the authorizer decides on: who is asking, for what.
function viewerContext(event) {
    const request = event.request;
    const headers = {};
    for (let i = 0; i < FORWARDED_HEADERS.length; i++) {
        headers[FORWARDED_HEADERS[i]] = headerValue(request.headers, FORWARDED_HEADERS[i]);
    }
    return {
        ip: event.viewer.ip,
        uri: request.uri,
        method: request.method,
        headers: headers,
    };
}

// The one network call. Resolves to { ok, status, decision }; throws when the authorizer
// cannot be asked or its answer is not JSON.
async function askAuthorizer(context) {
    const body = JSON.stringify(context);
    const authorizerResponse = await cf.fetch(AUTHORIZE_PATH, {
        originId: AUTHORIZER_ORIGIN_ID,
        method: 'POST',
        headers: { 'content-type': 'application/json' }, // plain strings, not { value } objects
        body: body,
        includeBody: true, // default false; the decision is in the body
    });
    if (!authorizerResponse.ok) {
        return { ok: false, status: authorizerResponse.status };
    }
    const text = await authorizerResponse.text(); // assign first: no await inside call arguments
    return { ok: true, status: authorizerResponse.status, decision: JSON.parse(text) };
}

// Copy only the allowed identity headers, lowercased.
function grantIdentityHeaders(headers, granted) {
    for (const name in granted) {
        const lowerName = name.toLowerCase();
        if (IDENTITY_HEADERS.indexOf(lowerName) !== -1) {
            headers[lowerName] = { value: String(granted[name]) };
        }
    }
}

function deny(status, code, error) {
    const headers = {
        'content-type': { value: 'application/json' },
        'cache-control': { value: 'no-store' },
    };
    if (error) {
        headers[ERROR_HEADER] = { value: error };
    }
    return {
        statusCode: status,
        statusDescription: STATUS_TEXT[status],
        headers: headers,
        body: JSON.stringify({ error: code }),
    };
}

async function handler(event) {
    const request = event.request;
    const headers = request.headers;
    stripIdentityHeaders(headers);

    // No token, or an empty one: refuse here, without spending the network call.
    const authorization = headers.authorization;
    if (!authorization || !authorization.value.trim()) {
        const missing = deny(401, 'missing_token');
        missing.headers['www-authenticate'] = { value: 'Bearer' };
        return missing;
    }

    let answer;
    try {
        answer = await askAuthorizer(viewerContext(event));
    } catch (error) {
        // Fail closed: TypeError, TimeoutError, InternalError, or a body that is not JSON.
        return deny(503, 'authorizer_unavailable', error.name + ': ' + error.message);
    }
    if (!answer.ok) {
        return deny(503, 'authorizer_unavailable', 'authorizer returned ' + answer.status);
    }

    const decision = answer.decision;
    if (!decision || decision.allow !== true) {
        return deny(403, 'forbidden');
    }

    grantIdentityHeaders(headers, decision.headers || {});
    return request;
}
