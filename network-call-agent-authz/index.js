import cf from 'cloudfront';

// Viewer request function.
// A client (for example an AI agent) sends a scoped token on every request. The token proves
// who the client is, not whether it may touch THIS resource right now, so the function asks an
// authorization service with one network call, POST /v1/check { action, resource, token }, and
// forwards the request only on { allowed: true }.
//   No Authorization header -> 401, no call.
//   Not allowed             -> 403.
//   Service cannot be asked -> 503 (fail closed).
// Viewer request runs before the cache, so allowed reads can still be cache hits.

// The origin id (the origin's Name in the console) of the authorization service on this distribution.
const AUTHZ_ORIGIN_ID = 'authz';
const CHECK_PATH = '/v1/check';
const ERROR_HEADER = 'x-agent-authz-error';
const STATUS_TEXT = { 401: 'Unauthorized', 403: 'Forbidden', 503: 'Service Unavailable' };

// What the client wants to do: read or write this URI, with this token.
function accessCheck(request, token) {
    return {
        action: request.method === 'GET' || request.method === 'HEAD' ? 'read' : 'write',
        resource: request.uri,
        // In the body, not the call's authorization header: with origin access control,
        // CloudFront signs the call and owns that header.
        token: token,
    };
}

// The one network call. Resolves to { ok, status, decision }; throws when the service
// cannot be asked or its answer is not JSON.
async function askAuthz(check) {
    const body = JSON.stringify(check);
    const authzResponse = await cf.fetch(CHECK_PATH, {
        originId: AUTHZ_ORIGIN_ID,
        method: 'POST',
        headers: { 'content-type': 'application/json' }, // plain strings, not { value } objects
        body: body,
        includeBody: true, // default false; the decision is in the body
    });
    if (!authzResponse.ok) {
        return { ok: false, status: authzResponse.status };
    }
    const text = await authzResponse.text(); // assign first: no await inside call arguments
    return { ok: true, status: authzResponse.status, decision: JSON.parse(text) };
}

function deny(status, code, error) {
    const headers = {
        'content-type': { value: 'application/json' },
        'cache-control': { value: 'no-store' },
    };
    if (status === 401) {
        headers['www-authenticate'] = { value: 'Bearer' };
    }
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
    const authorization = request.headers.authorization;
    if (!authorization) {
        return deny(401, 'unauthorized');
    }

    let answer;
    try {
        answer = await askAuthz(accessCheck(request, authorization.value));
    } catch (error) {
        // Fail closed: TypeError, TimeoutError, InternalError, or a body that is not JSON.
        return deny(503, 'authz_unavailable', error.name + ': ' + error.message);
    }
    if (!answer.ok) {
        return deny(503, 'authz_unavailable', 'authz returned ' + answer.status);
    }

    const decision = answer.decision;
    if (!decision || decision.allowed !== true) {
        return deny(403, 'forbidden');
    }
    return request;
}
