import cf from 'cloudfront';
import crypto from 'crypto';

// Viewer request function.
// A virtual waiting room. The queue is two integers: a ticket counter behind an origin and a
// watermark (serving) in KeyValueStore.
//   valid pass cookie (wr_a)          -> forwarded, x-wr: admitted, no call
//   ticket cookie (wr_t) >= serving   -> waiting page with the position, no call
//   ticket cookie (wr_t) <  serving   -> 302 to the same URL with a new pass, no call
//   no ticket, browser page load      -> one call: POST /enqueue draws a ticket (fail closed)
//   no ticket, anything else          -> 503 browsers-only, no call
//   GET <prefix>leave                 -> cookies cleared, one cf.beacon frees the place
// An admission job raises the watermark in KVS; AWS WAF guards the counter with a CAPTCHA.

// The origin id (the origin's Name in the console) of the queue API on this distribution.
const QUEUE_ORIGIN_ID = 'waiting-room';
const ENQUEUE_PATH = '/enqueue';
const LEAVE_PATH = '/leave';
// The path the waiting room protects: cookies are scoped to it, and <prefix>leave leaves the line.
const PATH_PREFIX = '/';
const STATE_KEY = 'queue-state'; // from the admission job: { mode, epoch, serving, step, tick }
const SECRET_KEYS = ['queue-secret-cur', 'queue-secret-prev']; // cur signs, either verifies
const SHARDS = 8; // counter items; the admission job reads the same number
const ADMIT_SECONDS = 120; // wr_a lifetime; renewing it is free while wr_t is below the watermark
const TICKET_SECONDS = 7200;
const STALE_MS = 5 * 60 * 1000; // queue-state older than this: the admission job stopped ticking
const REFRESH_SECONDS = 5;
const TICKET_COOKIE = 'wr_t';
const PASS_COOKIE = 'wr_a';
const WAF_TOKEN_COOKIE = 'aws-waf-token';
const COOKIE_ATTRIBUTES = 'Path=' + PATH_PREFIX + '; Secure; HttpOnly; SameSite=Lax';
const JWT_HEADER = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'; // {"alg":"HS256","typ":"JWT"}, the only header accepted
// Inserted by an AWS WAF count rule from the Bot Control token id label; WAF overwrites any viewer copy.
const WAF_TOKEN_ID_HEADER = 'x-amzn-waf-wr-token-id';
const JA4_HEADER = 'cloudfront-viewer-ja4-fingerprint';
const DOC = '<!doctype html><meta charset="utf-8">';
const VERDICT_HEADER = 'x-wr';
const PLACE_HEADER = 'x-wr-place';

function headerValue(headers, name) {
    return headers[name] ? headers[name].value : '';
}

function sign(secret, text) {
    return crypto.createHmac('sha256', secret).update(text).digest('base64url');
}

function sha256(text, encoding) {
    return crypto.createHash('sha256').update(text).digest(encoding);
}

function signJwt(claims, secret) {
    const signed = JWT_HEADER + Buffer.from(JSON.stringify(claims)).toString('base64url');
    return signed + '.' + sign(secret, signed);
}

// Constant time: timing never tells how much of a signature matched.
function constantTimeEquals(expected, actual) {
    let difference = expected.length ^ actual.length;
    for (let i = 0; i < expected.length; i++) {
        difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
    }
    return difference === 0;
}

// The claims of a token this queue signed, or null.
function verifyJwt(cookie, secrets) {
    const token = cookie ? cookie.value : '';
    const dot = token.lastIndexOf('.');
    if (token.indexOf(JWT_HEADER) !== 0 || dot <= JWT_HEADER.length) {
        return null;
    }
    let valid = false;
    for (let i = 0; i < secrets.length; i++) {
        if (constantTimeEquals(sign(secrets[i], token.slice(0, dot)), token.slice(dot + 1))) {
            valid = true;
        }
    }
    if (!valid) {
        return null;
    }
    try {
        return JSON.parse(Buffer.from(token.slice(JWT_HEADER.length, dot), 'base64url').toString());
    } catch (error) {
        return null;
    }
}

// no-store: any answer may carry a ticket or a pass.
function respond(statusCode, verdict, extraHeaders, body) {
    const headers = {
        'cache-control': { value: 'no-store' },
        'content-type': { value: 'text/html; charset=utf-8' },
    };
    headers[VERDICT_HEADER] = { value: verdict };
    const response = { statusCode: statusCode, headers: Object.assign(headers, extraHeaders) };
    if (body) {
        response.body = body;
    }
    return response;
}

function withCookie(response, name, value, maxAge) {
    response.cookies = response.cookies || {};
    response.cookies[name] = { value: value, attributes: COOKIE_ATTRIBUTES + '; Max-Age=' + maxAge };
    return response;
}

function waitingPage(verdict, title, line) {
    const html = DOC + '<meta http-equiv="refresh" content="' + REFRESH_SECONDS + '">' +
        '<title>' + title + '</title><body style="font:18px system-ui;max-width:34em;margin:4em auto">' +
        '<h1>' + title + '</h1><p>' + line + '</p>' +
        '<p><a href="' + PATH_PREFIX + 'leave">Leave the line</a></p>';
    return respond(200, verdict, { 'retry-after': { value: String(REFRESH_SECONDS) } }, html);
}

function expiredCookie(domain) {
    return { value: '', attributes: 'Path=/; Secure; ' + domain + 'Max-Age=0' };
}

// Clears the HttpOnly cookies and aws-waf-token (both Domain forms), so the CAPTCHA comes back.
function leftPage(host, place) {
    const extraHeaders = {};
    extraHeaders[PLACE_HEADER] = { value: place };
    const page = respond(200, 'left', extraHeaders,
        DOC + '<title>You left the line</title><p>You left the line. <a href="' + PATH_PREFIX + '">Join again</a></p>');
    withCookie(withCookie(page, TICKET_COOKIE, '', 0), PASS_COOKIE, '', 0);
    const wafToken = [expiredCookie(''), expiredCookie('Domain=' + host + '; ')];
    page.cookies[WAF_TOKEN_COOKIE] = Object.assign(expiredCookie(''), { multiValue: wafToken });
    return page;
}

// KVS reads, not network calls; a missing key leaves state null or a secret out.
// allSettled, not all: a missing previous secret must not throw away the state.
async function readQueue() {
    const store = cf.kvs();
    const reads = await Promise.allSettled([
        store.get(STATE_KEY, { format: 'json' }),
        store.get(SECRET_KEYS[0]),
        store.get(SECRET_KEYS[1]),
    ]);
    const secrets = [];
    for (let i = 1; i < reads.length; i++) {
        if (reads[i].status === 'fulfilled' && reads[i].value) {
            secrets.push(reads[i].value);
        }
    }
    return { state: reads[0].status === 'fulfilled' ? reads[0].value : null, secrets: secrets };
}

// One cf.beacon puts the ticket in a skip set (a set: a replayed cookie frees one place).
function leaveLine(state, ticket, host) {
    if (ticket < 0 || ticket < state.serving) {
        return leftPage(host, 'none');
    }
    try {
        cf.beacon(LEAVE_PATH, {
            originId: QUEUE_ORIGIN_ID,
            method: 'POST',
            headers: { 'content-type': 'application/json' }, // plain strings, not { value } objects
            body: JSON.stringify({ epoch: state.epoch, ticket: ticket }),
            logDeliveryErrors: true, // late failures go to CloudWatch Logs
        });
        return leftPage(host, 'freed');
    } catch (error) {
        return leftPage(host, 'failed'); // only an invalid call throws
    }
}

// wr_a binds to a hash of the WAF token id, the user agent and JA4: a copied pass fails elsewhere.
function clientBinding(headers) {
    const client = [headerValue(headers, WAF_TOKEN_ID_HEADER), headerValue(headers, 'user-agent'),
        headerValue(headers, JA4_HEADER)].join('|');
    return sha256(client, 'base64url').slice(0, 22);
}

function positionPage(ticket, state, now) {
    if (now * 1000 - state.tick > STALE_MS) {
        return waitingPage('paused', 'The queue is paused', 'You keep your place in line.');
    }
    const ahead = ticket - state.serving + 1;
    const minutes = Math.ceil(ahead / Math.max(state.step, 1));
    return waitingPage('waiting', 'You are in line', 'Position about <b>' + ahead + '</b>, roughly ' + minutes + ' min.');
}

// The one network call: the shard's counter hands out its next number, or throws.
async function drawTicket(epoch, shard) {
    const enqueueResponse = await cf.fetch(ENQUEUE_PATH, {
        originId: QUEUE_ORIGIN_ID,
        method: 'POST',
        headers: { 'content-type': 'application/json' }, // plain strings, not { value } objects
        body: JSON.stringify({ epoch: epoch, shard: shard }),
        includeBody: true, // default false; the counter is in the body
    });
    if (!enqueueResponse.ok) {
        throw new Error('enqueue returned ' + enqueueResponse.status); // 429: the API throttled
    }
    const text = await enqueueResponse.text(); // assign first: no await inside call arguments
    const ticket = (JSON.parse(text).n - 1) * SHARDS + shard;
    if (!(ticket >= 0)) {
        throw new Error('enqueue sent no counter');
    }
    return ticket;
}

async function handler(event) {
    const request = event.request;
    const headers = request.headers;
    const now = Math.floor(Date.now() / 1000); // JWT times are in seconds
    delete headers[VERDICT_HEADER]; // only this function tells the origin what happened

    const queue = await readQueue();
    const state = queue.state;
    const secrets = queue.secrets;
    // The epoch makes a counter reset safe: tickets of an old line stop counting.
    const claims = state ? verifyJwt(request.cookies[TICKET_COOKIE], secrets) : null;
    const ticket = claims && claims.epoch === state.epoch && typeof claims.ticket === 'number' ? claims.ticket : -1;

    if (request.uri === PATH_PREFIX + 'leave') {
        return leaveLine(state, ticket, headerValue(headers, 'host'));
    }
    if (state && state.mode === 'off') {
        headers[VERDICT_HEADER] = { value: 'off' };
        return request;
    }
    if (!state || !secrets.length) {
        return waitingPage('starting', 'The queue is starting', 'Please wait a moment.');
    }

    const binding = clientBinding(headers);
    const pass = verifyJwt(request.cookies[PASS_COOKIE], secrets);
    if (pass && pass.epoch === state.epoch && pass.exp > now && pass.bnd === binding) {
        headers[VERDICT_HEADER] = { value: 'admitted' };
        return request;
    }

    // In line. Tickets below the watermark are admitted.
    if (ticket >= 0) {
        if (ticket >= state.serving) {
            return positionPage(ticket, state, now);
        }
        const admitted = respond(302, 'admit', { location: { value: request.uri } });
        const newPass = signJwt({ epoch: state.epoch, exp: now + ADMIT_SECONDS, bnd: binding }, secrets[0]);
        return withCookie(admitted, PASS_COOKIE, newPass, ADMIT_SECONDS);
    }

    // No ticket. Only a browser page load may draw one.
    if (request.method !== 'GET' || headerValue(headers, 'accept').indexOf('text/html') === -1) {
        return respond(503, 'browsers-only',
            { 'content-type': { value: 'application/json' }, 'retry-after': { value: String(REFRESH_SECONDS) } },
            '{"waitingRoom":"open this URL in a browser"}');
    }

    // A hash of the request id, not Math.random(): no network call may follow random values.
    const shard = parseInt(sha256(event.context.requestId, 'hex').slice(0, 8), 16) % SHARDS;
    let drawn;
    try {
        drawn = await drawTicket(state.epoch, shard);
    } catch (error) {
        // Fail closed: no ticket, nothing reaches the origin, the page retries.
        return waitingPage('busy', 'Busy, retrying', 'The line is very long right now (' + error.name + ').');
    }
    const queued = waitingPage('queued', 'You are in line', 'Your ticket is <b>' + drawn + '</b>. Finding your position.');
    const newTicket = signJwt({ epoch: state.epoch, ticket: drawn, iat: now }, secrets[0]);
    return withCookie(queued, TICKET_COOKIE, newTicket, TICKET_SECONDS);
}
