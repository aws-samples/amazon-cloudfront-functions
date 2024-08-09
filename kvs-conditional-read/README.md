## Rewrite request URI

**CloudFront Functions event type: viewer request**

This example provides a dynamic request URI rewriting mechanism, allowing for A/B testing or gradual rollout of application versions, while also maintaining user stickiness to ensure a consistent experience. It rewrites the request URI based on a configuration stored in CloudFront KeyValueStore. Using your KeyValueStore ID in the code is optional.
