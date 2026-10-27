import cf from 'cloudfront';
import crypto from 'crypto';

// Response when JWT is not valid
const response401 = { statusCode: 401, statusDescription: 'Unauthorized' };

// Remember to associate the KVS with your function before calling the const kvsKey = 'jwt.secret'.
// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/kvs-with-functions-associate.html
const kvsKey = 'jwt.secret';
// set to true to enable console logging
const loggingEnabled = false;

function jwtVerify(token, key) {
    // check token
    if (!token) {
        throw new Error('No token supplied');
    }
    // check segments
    const segments = token.split('.');
    if (segments.length !== 3) {
        throw new Error('Not enough or too many segments');
    }

    // Verify the HS256 signature
    const expected = crypto.createHmac('sha256', key).update(`${segments[0]}.${segments[1]}`).digest('base64url');
    if (!_constantTimeEquals(segments[2], expected)) {
        throw new Error('Signature verification failed');
    }

    // base64 decode and parse JSON
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url'));

    // Support for nbf and exp claims.
    // According to the RFC, they should be in seconds.
    if (payload.nbf && Date.now() < payload.nbf*1000) {
        throw new Error('Token not yet active');
    }

    if (!payload.exp || Date.now() > payload.exp*1000) {
        throw new Error('Token expired or missing exp');
    }

    return payload;
}

// Constant-time comparison to prevent timing side channels
function _constantTimeEquals(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    let xor = 0;
    for (let i = 0; i < a.length; i++) {
        xor |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return xor === 0;
}

async function handler(event) {
    const request = event.request;

    // Secret key used to verify the JWT, read from KeyValueStore
    const secretKey = await getSecret();

    if (!secretKey) {
        return response401;
    }

    // No JWT in the query string, return 401
    if (!request.querystring.jwt) {
        log("Error: No JWT in the querystring");
        return response401;
    }

    const jwtToken = request.querystring.jwt.value;

    try {
        jwtVerify(jwtToken, secretKey);
    } catch (e) {
        log(e.message);
        return response401;
    }

    // Remove the JWT from the query string if valid and return
    delete request.querystring.jwt;
    log("Valid JWT token");
    return request;
}

// get secret from key value store
async function getSecret() {
    // initialize cloudfront kv store and get the key value
    try {
        const kvsHandle = cf.kvs();
        return await kvsHandle.get(kvsKey);
    } catch (err) {
        log(`Error reading value for key: ${kvsKey}, error: ${err}`);
        return null;
    }
}

function log(message) {
    if (loggingEnabled) {
        console.log(message);
    }
}
