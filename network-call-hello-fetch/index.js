import cf from 'cloudfront';

// Viewer request function.
// Makes one network call: GET /hello on an origin of this distribution, then copies one
// field of the JSON answer into a request header. If the call fails, the request still
// goes through, with the error in a header (fail open).

// The origin id (the origin's Name in the console) of an origin on this distribution.
const HELLO_ORIGIN_ID = 'hello-origin';
const HELLO_PATH = '/hello';
const MESSAGE_HEADER = 'x-hello-message';
const STATUS_HEADER = 'x-hello-status';
const ERROR_HEADER = 'x-hello-error';

async function handler(event) {
    const request = event.request;

    // Never pass on viewer-supplied copies of the headers this function sets.
    delete request.headers[MESSAGE_HEADER];
    delete request.headers[STATUS_HEADER];
    delete request.headers[ERROR_HEADER];

    try {
        const helloResponse = await cf.fetch(HELLO_PATH, {
            originId: HELLO_ORIGIN_ID,
            includeBody: true, // default false; needed to read the body
        });
        const text = await helloResponse.text(); // assign first: no await inside call arguments
        const hello = JSON.parse(text);
        request.headers[MESSAGE_HEADER] = { value: String(hello.message) };
        request.headers[STATUS_HEADER] = { value: String(helloResponse.status) };
    } catch (error) {
        // TypeError, TimeoutError, InternalError, or a body that is not JSON.
        request.headers[ERROR_HEADER] = { value: error.name + ': ' + error.message };
    }
    return request;
}
