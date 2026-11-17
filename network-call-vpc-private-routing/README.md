## Network call: routing through a private service in a VPC

**CloudFront Functions event type: viewer request**

This function asks a **private** routing service which backend a tenant belongs to, with one `cf.fetch` call, and rewrites the URI to that backend: `/orders/1` becomes `/blue/orders/1` or `/green/orders/1`, and `x-backend` says which. The tenant is the viewer's `x-tenant` header, or `guest`. The routing service is an internal Application Load Balancer with no public address, reached through a CloudFront [VPC origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html).

Why a network call: the tenant-to-backend map lives in a private service (a tenant database, a placement service) that never gets a public address, and a function can reach it through a VPC origin like any other origin.

A [CloudFront KeyValueStore](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/kvs-with-functions.html) kill switch skips the call entirely. It is read before the call, never in parallel: once the call has started, the switch can no longer stop it. Routing is a convenience, not an access decision, so the function fails open: any failure forwards the request unchanged, and a KVS error leaves routing on. The function deletes viewer-supplied `x-backend`, `x-routing-error` and `x-routing-kvs-error` headers, and overwrites `x-tenant` with the value it used.

### Requirements

- **Runtime** `cloudfront-js-2.0`. Network calls are not available with continuous deployment or the free pricing plan.
- **A CloudFront VPC origin to an internal Application Load Balancer**, on the same distribution, with the origin id `private-router` (the origin's **Name** in the console; change `ROUTER_ORIGIN_ID` at the top of `index.js` to use another). The ALB is in private subnets, and its security group admits only the CloudFront origin-facing managed prefix list. The VPC needs an internet gateway, even though nothing routes through it. **Use HTTPS to the ALB in production**: an HTTPS listener with an ACM certificate for a domain you own, the VPC origin's protocol policy `HTTPS_ONLY`, and port 443 in the security group. The deployable version below uses plain HTTP only so that it deploys without a domain.
- **The origin contract**:

  | | |
  |---|---|
  | Request | `GET /route?tenant=<tenant>` on `private-router`, the tenant URI-encoded. The viewer's own headers are not copied onto the call |
  | Answer | `200` with `{"backend": "blue"}` or `{"backend": "green"}` (change `BACKENDS` for your names). At most 10 KB |
  | Time | The whole answer within 1 second. This is fixed by the runtime and cannot be changed; past it the request is forwarded unchanged |

- **The routed request**: the cache behavior's origin serves `/<backend>/...`. It can be the same ALB, with a listener rule per backend prefix, so one VPC origin is enough. It must also answer the unchanged URI, which is what it gets when routing is off or the call failed.
- **KeyValueStore (optional)**: the key `routing-kill-switch` with the value `off` turns routing off. Only that exact lower-case value does; without a KVS, without the key, or with any other value, routing is on.
- The tenant is viewer input, not an identity. A viewer can name any tenant, or force a failed call with an over-long one (`PathTooLarge`), so do not use the backend prefix for access control.

### Deploy

[Create a KeyValueStore](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/kvs-with-functions-create.html) if you want the kill switch. Then follow [Deploying a CloudFront function using the AWS CLI](../README.md#deploying-a-cloudfront-function-using-the-aws-cli) in the root README, with these values:

```
aws cloudfront create-function \
--name network-call-vpc-private-routing \
--function-config '{"Comment":"Tenant routing through a VPC origin","Runtime":"cloudfront-js-2.0","KeyValueStoreAssociations":{"Quantity":1,"Items":[{"KeyValueStoreARN":"arn:aws:cloudfront::XXXXXXXXXXXX:key-value-store/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"}]}}' \
--function-code fileb://network-call-vpc-private-routing/index.js
```

Leave out `KeyValueStoreAssociations` to run without a kill switch. Then publish it with `aws cloudfront publish-function` and add it to a cache behavior, with `"EventType": "viewer-request"`. To turn routing off:

```
aws cloudfront-keyvaluestore put-key \
--kvs-arn arn:aws:cloudfront::XXXXXXXXXXXX:key-value-store/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX \
--key routing-kill-switch --value off \
--if-match EXXXXXXXXXXXX
```

### How it fails

| What goes wrong | The viewer gets | Header on the forwarded request |
|---|---|---|
| Kill switch `off` | forwarded unchanged, no call | `x-backend: off` |
| The route service answers non-2xx, a body that is not JSON, or an unknown backend | forwarded unchanged | `x-routing-error` |
| `TypeError`, `TimeoutError` (no full answer within 1 second), `InternalError` | forwarded unchanged | `x-routing-error: <name>: <message>` |
| A tenant so long that the `/route` path is over 8 KB | forwarded unchanged | `x-routing-error: TypeError: ... PathTooLarge` |
| No KVS, or a KVS error other than a missing key | routing stays on | `x-routing-kvs-error` |

A deployable version with the origin and infrastructure: https://github.com/aws-samples/sample-cloudfront-functions-network-calls-patterns/tree/main/patterns/06-vpc-private-routing/
