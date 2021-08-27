## Add CORS header

**CloudFront Functions event type: viewer response**

This function adds an [Access-Control-Allow-Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin) response header if it is not present in the outgoing response from CloudFront. The `Access-Control-Allow-Origin` header is part of [Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) (CORS), a mechanism using HTTP headers to tell browsers to give a web application running at one origin access to selected resources from a different origin. The `Access-Control-Allow-Origin` response header indicates whether the response can be shared with requesting code from the given origin. In this example, we are setting the value to the [Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin) request header, if the origin header is present.

***Important: Set the value of the Access-Control-Allow-Origin header to an appropriate value for your specific needs.**

If your web site or application doesn't need CORS headers, then this function is not required.

**Testing the function**

To validate that the function is working as expected, you can use the JSON test objects in the `test-objects` directory. To test, you can use the `test-function` CLI command that will look something like this:

```
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name add-cors-header --event-object fileb://add-cors-header/test-objects/no-cors-header.json
```

If the function has been set up correctly, you should see a result similar to the following with the `access-control-allow-origin` header being added in the `FunctionOutput` JSON object:
```
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "add-cors-header",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-1.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::1234567890:function/add-cors-header",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2021-04-08T23:37:50.825000+00:00",
                "LastModifiedTime": "2021-04-08T23:37:51.096000+00:00"
            }
        },
        "ComputeUtilization": "16",
        "FunctionExecutionLogs": [
            "Access-Control-Allow-Origin was missing, adding it now."
        ],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"response\":{\"headers\":{\"access-control-allow-origin\":{\"value\":\"https:\/\/www.example.com\"},\"server\":{\"value\":\"CustomOriginServer\"},\"content-length\":{\"value\":\"9593\"},\"content-type\":{\"value\":\"text/html; charset=UTF-8\"}},\"statusDescription\":\"OK\",\"cookies\":{\"loggedIn\":{\"attributes\":\"Secure; Path=/; Domain=example.com; Expires=Wed, 05 Jan 2024 07:28:00 GMT\",\"value\":\"true\"},\"id\":{\"attributes\":\"Expires=Wed, 05 Jan 2024 07:28:00 GMT\",\"value\":\"a3fWa\"}},\"statusCode\":200}}"
    }
}
```
