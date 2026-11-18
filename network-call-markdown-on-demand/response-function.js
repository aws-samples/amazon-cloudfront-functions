// Viewer response function. No network call.
// An Amazon S3 origin echoes nothing, so this copies the x-markdown verdict that index.js left
// on the request onto the response, and adds Vary: the same URL answers HTML or markdown.
// CloudFront does not run viewer response functions when the origin answered 400 or higher.

const VERDICT_HEADERS = ['x-markdown', 'x-markdown-error'];
const VARY = 'Accept, User-Agent'; // Accept, and the user agent Bot Control labels by

function handler(event) {
    const requestHeaders = event.request.headers;
    const response = event.response;
    for (let i = 0; i < VERDICT_HEADERS.length; i++) {
        const header = requestHeaders[VERDICT_HEADERS[i]];
        if (header) {
            response.headers[VERDICT_HEADERS[i]] = { value: header.value };
        }
    }
    response.headers['vary'] = { value: VARY };
    return response;
}
