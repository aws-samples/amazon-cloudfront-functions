## Rediret any host that is not the enforced domain

**CloudFront Functions event type: viewer request**

This function redirects all users to an enforced domain name. This ensures that all users are using your preferred domain name when accessing your site. The most common example of this is to automatically redirect the *apex* or *naked* domain to the *www* domain. When accessing through the enforced domain, this function does not perform any action.

**Important: Set the `enforceDomainName` constant to an appropriate value for your specific needs.**

**Testing the function**

To validate that the function is working as expected, you can use the JSON test objects in the `test-objects` directory. To test, use the `test-function` CLI command as shown in the following examples:

**Apex or naked domain redirect**

This test validates that a request to the `example.com` domain will be redirected to the `www.example.com` domain.

```shell
# Get the current ETag value
$ aws cloudfront describe-function --name enforce-domain-redirect
# Run the test
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name enforce-domain-redirect --event-object fileb://enforce-domain-redirect/test-objects/apex-domain.json
```

If the function has been set up correctly, you should see a result similar to the following with the redirect being issued (`location` header being returned) in the `FunctionOutput` JSON object. Notice that the `value` is the `enforceDomainName` value:

```json
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "enforce-domain-redirect",
            "Status": "UNASSOCIATED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-2.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::060232822672:function/enforce-domain-redirect",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2024-10-01T14:36:47.121000+00:00",
                "LastModifiedTime": "2024-10-01T14:37:08.199000+00:00"
            }
        },
        "ComputeUtilization": "6",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"response\":{\"headers\":{\"location\":{\"value\":\"https://www.example.com\"}},\"statusDescription\":\"Moved Permanently\",\"cookies\":{},\"statusCode\":301}}"
    }
}
```

**No redirect when using enforced domain**

```shell
# Get the current ETag value
$ aws cloudfront describe-function --name enforce-domain-redirect
# Run the test
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name enforce-domain-redirect --event-object fileb://enforce-domain-redirect/test-objects/apex-domain.json
```

If the function has been set up correctly, you should see the `request` being returned as part of the `FunctionOutput` JSON object meaning that no action was taken.:

```json
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "enforce-domain-redirect",
            "Status": "UNASSOCIATED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-2.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::060232822672:function/enforce-domain-redirect",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2024-10-01T14:36:47.121000+00:00",
                "LastModifiedTime": "2024-10-01T14:37:08.199000+00:00"
            }
        },
        "ComputeUtilization": "6",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"request\":{\"headers\":{\"host\":{\"value\":\"www.example.com\"},\"accept\":{\"value\":\"text/html\"}},\"method\":\"GET\",\"querystring\":{},\"uri\":\"/index.html\",\"cookies\":{}}}"
    }
}
```
