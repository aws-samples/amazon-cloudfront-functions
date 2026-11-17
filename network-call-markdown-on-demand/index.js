import cf from 'cloudfront';

// Viewer request function.
// AI agents get a markdown copy of a page, made the first time one asks for it:
//   not an agent, or not a page -> x-markdown: skipped, no call
//   KVS has md:<uri>            -> URI rewritten to the .md object, x-markdown: served, no call
//   no key yet                  -> the HTML as usual, plus one cf.beacon { uri, minute } to a
//                                  queue, x-markdown: queued (failed if cf.beacon threw)
// A worker behind the queue converts the page, then writes the .md and the KVS key.
// KVS answers "does markdown exist yet" without spending the one network call.

// The origin id (the origin's Name in the console) of the queue API on this distribution.
const QUEUE_ORIGIN_ID = 'markdown-queue';
const CONVERT_PATH = '/convert';
const INDEX_DOCUMENT = 'index.html';
const MARKDOWN_KEY_PREFIX = 'md:'; // md:<page uri> -> the .md object's URI, written by the worker
const MARKDOWN_TYPE = 'text/markdown';
const MS_PER_MINUTE = 60000;
// .html pages only, no dots elsewhere: the worker must accept exactly the same URIs.
const PAGE = /^\/[\w\/-]{1,200}\.html$/;
// An agent says so with Accept, or AWS WAF Bot Control labels it an AI bot. A web ACL rule
// writes this header on every request (the bot's name, or none), overwriting any viewer copy.
const WAF_AGENT_HEADER = 'x-amzn-waf-ai-agent';
const NOT_AN_AGENT = 'none';
const MARKDOWN_HEADER = 'x-markdown';
const ERROR_HEADER = 'x-markdown-error';

function headerValue(headers, name) {
    return headers[name] ? headers[name].value : '';
}

function describeError(error) {
    return error.name + ': ' + error.message;
}

function isAgent(headers) {
    const wafAgent = headerValue(headers, WAF_AGENT_HEADER);
    const asksForMarkdown = headerValue(headers, 'accept').indexOf(MARKDOWN_TYPE) !== -1;
    return asksForMarkdown || (wafAgent !== '' && wafAgent !== NOT_AN_AGENT);
}

// The one network call, fire-and-forget. Throws only for an invalid call (TypeError).
function sendToQueue(message) {
    cf.beacon(CONVERT_PATH, {
        originId: QUEUE_ORIGIN_ID,
        method: 'POST',
        headers: { 'content-type': 'application/json' }, // plain strings, not { value } objects
        body: JSON.stringify(message),
        logDeliveryErrors: true, // a delivery failure after the function returned goes to CloudWatch Logs
    });
}

async function handler(event) {
    const request = event.request;
    const headers = request.headers;
    // Only this function tells the response side what happened: drop viewer-supplied copies.
    delete headers[MARKDOWN_HEADER];
    delete headers[ERROR_HEADER];

    // An Amazon S3 origin has no index document below the root: a folder means its index.html.
    if (request.uri.slice(-1) === '/') {
        request.uri += INDEX_DOCUMENT;
    }
    const uri = request.uri;
    if (!isAgent(headers) || !PAGE.test(uri)) {
        headers[MARKDOWN_HEADER] = { value: 'skipped' };
        return request;
    }

    // 1. KVS. A missing key, or no KVS associated, throws: not converted yet.
    try {
        request.uri = await cf.kvs().get(MARKDOWN_KEY_PREFIX + uri);
        headers[MARKDOWN_HEADER] = { value: 'served' };
        return request;
    } catch (error) {
        // KeyNotFound: fall through and ask for a conversion.
    }

    // 2. Miss: the HTML goes out as usual; one message asks for markdown.
    try {
        // The URI and the minute: a FIFO queue with content-based deduplication turns a burst
        // into one message, and a page whose key was deleted can be queued again a minute later.
        sendToQueue({ uri: uri, minute: Math.floor(Date.now() / MS_PER_MINUTE) });
        headers[MARKDOWN_HEADER] = { value: 'queued' };
    } catch (error) {
        headers[MARKDOWN_HEADER] = { value: 'failed' };
        headers[ERROR_HEADER] = { value: describeError(error) };
    }
    return request;
}
