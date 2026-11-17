## Network call: origin health probe and POST failover

**CloudFront Functions event types: viewer request (`index.js`) and viewer response (`response-function.js`)**

[Origin groups](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html) fail over only `GET`, `HEAD` and `OPTIONS` requests, so a `POST` to a primary origin that is down simply fails. This function decides before the request leaves the edge: it probes `GET /health` on the primary with one `cf.fetch` call, and if the primary is slow or down it sends the request somewhere else with `cf.selectRequestOriginById`:

- `POST`, `PUT`, `PATCH`, `DELETE` go to a secondary origin that can take writes (another Region, another provider).
- `GET` and `HEAD` go to a static mirror (for example an Amazon S3 bucket with the same paths). When the primary is healthy, they also get a runtime origin group (primary, then the mirror on `500`, `502`, `503` or `504`) with `cf.createRequestOriginGroup`, at no extra call.

The probe costs one call per request, so it runs only when the [CloudFront KeyValueStore](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/kvs-with-functions.html) key `health-probe` is `on`. You can switch it on for an incident and off again without a new function version.

A probe that says nothing about the primary fails open to the primary: a `TypeError` for an invalid call, a failed KVS read, or an error from the origin helpers. Every other probe failure (non-2xx, `TimeoutError`, `InternalError`, or a `TypeError` saying the edge could not reach the primary) fails over. The function deletes viewer-supplied `x-route`, `x-route-error`, `x-health-probe` and `x-health-probe-error` headers first.

The optional response function makes no call. It maps an `x-origin` marker that the primary and the secondary set to `x-served-by` (no marker means the mirror answered), removes the marker, adds `x-fallback: true` when the primary did not answer, and copies the request function's verdict headers onto the response.

### Requirements

- **Runtime** `cloudfront-js-2.0`. Network calls are not available with continuous deployment or the free pricing plan.
- **Three origins on the same distribution**, by origin id (the origin's **Name** in the console; change the constants at the top of `index.js` to use others):
  - `primary`: the cache behavior's origin, which also serves `/health`.
  - `secondary`: takes the writes when the primary is down. It needs no cache behavior of its own.
  - `static-mirror`: serves the same paths for `GET` and `HEAD`. It needs no cache behavior of its own. The function adds `index.html` to a URI that ends in `/`.
- **The origin contract for the probe**:

  | | |
  |---|---|
  | Request | `GET /health` on `primary`, no body. The call is built from scratch: the viewer's headers, cookies and query string are not copied |
  | Answer | Any `2xx` means healthy. The body is not read. Answer non-2xx yourself when the primary is degraded |
  | Time | The whole answer within 1 second, fixed by the runtime. A slower primary counts as down, and the viewer waits about 1 second for the probe. There is no tighter limit: `Date.now()` does not advance during a function run, so the function cannot time the call itself |

- **KeyValueStore**: the key `health-probe` with the value `on`. Without a KVS, without the key, or with any other value, the probe is off and every request goes to the primary.
- **The cache behavior** must allow the methods you want to fail over (`GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`).
- **For the response function** (optional): the primary sets `x-origin: primary` and the secondary sets `x-origin: secondary` on their answers.
- **Lock the origins** so that only CloudFront can call them. Any origin type works. For a Lambda Web Function, use an `IamAuth` endpoint behind origin access control (OAC) that signs with `always-amz-auth`: CloudFront signs the probe and the forwarded `POST` (with an unsigned payload, so no body hash is needed). For the S3 mirror, use OAC on the bucket.

### Deploy

[Create a KeyValueStore](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/kvs-with-functions-create.html) with the key `health-probe` (value `off` until you need it). Then follow [Deploying a CloudFront function using the AWS CLI](../README.md#deploying-a-cloudfront-function-using-the-aws-cli) in the root README, with these values:

```
aws cloudfront create-function \
--name network-call-origin-health-failover \
--function-config '{"Comment":"Health probe and POST failover","Runtime":"cloudfront-js-2.0","KeyValueStoreAssociations":{"Quantity":1,"Items":[{"KeyValueStoreARN":"arn:aws:cloudfront::XXXXXXXXXXXX:key-value-store/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"}]}}' \
--function-code fileb://network-call-origin-health-failover/index.js

aws cloudfront create-function \
--name network-call-origin-health-served-by \
--function-config Comment="Annotate which origin answered",Runtime=cloudfront-js-2.0 \
--function-code fileb://network-call-origin-health-failover/response-function.js
```

Publish both with `aws cloudfront publish-function` and add them to the primary's cache behavior, the first with `"EventType": "viewer-request"` and the second with `"EventType": "viewer-response"`. Switch the probe on:

```
aws cloudfront-keyvaluestore put-key \
--kvs-arn arn:aws:cloudfront::XXXXXXXXXXXX:key-value-store/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX \
--key health-probe --value on \
--if-match EXXXXXXXXXXXX
```

### How it fails

| What goes wrong | Where the request goes | Header |
|---|---|---|
| Probe off | primary | `x-health-probe: off` |
| Probe `2xx` within 1 second | primary | `x-health-probe: ok` |
| Probe non-2xx | secondary or mirror | `x-health-probe: unhealthy:<status>` |
| `TimeoutError` (over 1 second) | secondary or mirror | `x-health-probe: unhealthy:timeout`, `x-health-probe-error` |
| `InternalError`, or `TypeError: ... could not be completed due to <result type>` (the edge could not reach the primary: `OriginDnsError`, `OriginConnectError`, `OriginCommError`, `AbortedOrigin`) | secondary or mirror | `x-health-probe: unhealthy:error`, `x-health-probe-error` |
| Any other `TypeError`: the call itself is invalid | primary (fail open) | `x-health-probe: unavailable`, `x-health-probe-error` |
| The origin helpers throw | primary | `x-route-error` |

A deployable version with the origin and infrastructure: https://github.com/aws-samples/sample-cloudfront-functions-network-calls-patterns/tree/main/patterns/08-origin-health-fallback/
