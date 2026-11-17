## Network call: hello fetch

**CloudFront Functions event type: viewer request**

This is the smallest network call: the function sends one `GET /hello` to an origin of the same distribution with `cf.fetch`, reads the JSON answer, and copies its `message` field into the `x-hello-message` request header before the request goes on to the origin. Use it to check the wiring (runtime, origin id, origin access control) before you build something bigger, or as the starting point for a function that needs one value from a service at request time.

The function fails open: if the call fails, the request still goes through, with the error in `x-hello-error`. It deletes viewer-supplied `x-hello-message`, `x-hello-status` and `x-hello-error` headers first, so the origin only sees values the function set.

### Requirements

- **Runtime** `cloudfront-js-2.0`. Network calls are not available with continuous deployment or the free pricing plan.
- **An origin on the same distribution** with the origin id `hello-origin` (the origin's **Name** in the console; change `HELLO_ORIGIN_ID` at the top of `index.js` to use another). The function cannot call host names or URLs, only origins of its own distribution. The origin does not need a cache behavior of its own.
- **The origin contract**:

  | | |
  |---|---|
  | Request | `GET /hello`, no body. The call is built from scratch: the viewer's headers, cookies and query string are not copied |
  | Answer | `200` with a JSON body such as `{"message": "hello from the origin"}`, at most 10 KB |
  | Time | The whole answer within 1 second. This is fixed by the runtime and cannot be changed |

- **Lock the origin** so that only CloudFront can call it. Any origin type works. For a Lambda Web Function, use an `IamAuth` endpoint behind origin access control (OAC) that signs with `always-amz-auth`: CloudFront signs the network call like a viewer request. A custom origin header (for example a shared secret that the origin checks) is also sent on the call.

### Deploy

Follow [Deploying a CloudFront function using the AWS CLI](../README.md#deploying-a-cloudfront-function-using-the-aws-cli) in the root README, with these values:

```
aws cloudfront create-function \
--name network-call-hello-fetch \
--function-config Comment="One network call to /hello",Runtime=cloudfront-js-2.0 \
--function-code fileb://network-call-hello-fetch/index.js
```

Then publish it with `aws cloudfront publish-function` and add it to a cache behavior of the distribution that has the `hello-origin` origin, with `"EventType": "viewer-request"`.

### How it fails

| What goes wrong | What the origin receives |
|---|---|
| The origin answers, but not with `200` | `x-hello-status` with that status. A `403` usually means the call did not pass the origin's lock |
| `TypeError` (a bad call, an unknown origin id, or the edge could not reach the origin) | `x-hello-error: TypeError: ...` |
| `TimeoutError` (no full answer within 1 second) or `InternalError` | `x-hello-error: TimeoutError: ...` or `InternalError: ...` |
| The answer is not JSON | `x-hello-error: SyntaxError: ...` |

A deployable version with the origin and infrastructure: <DEPLOYABLE_REPO_URL>/patterns/00-hello-fetch/
