## Add Cache-Control header

**CloudFront Functions event type: viewer response**

This function adds a `Cache-Control` header that is sent to the browser in the response from CloudFront. If your origin does not send a `Cache-Control` header, and you are relying on CloudFront's [cache behaviors](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html) to control CloudFront caching, CloudFront will not send a `Cache-Control` header to the browser for browser caching. This function adds a `Cache-Control` header for the browser so that content can be cached locally in the browser. This reduces CloudFront costs, while giving users of your site better performance.

If your origin sends a `Cache-Control` header in responses to CloudFront, this header is passed to the browser. In this case, this function is not required.

**Important: Set the `max-age` directive to an appropriate value for your specific needs.**

**Testing the function**

To validate that the function is working as expected, you can use the provided `test-event.json` test object. To test, you can use the `test-function` CLI command that will look something like this:

```
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name add-cache-control-headers --event-object fileb://add-cache-control-headers/test-event.json
```

If the function has been set up correctly, you should see a result similar to the following with the `cache-control` header being added in the `FunctionOutput` JSON object:
```
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "cache-control-headers",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-1.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::1234567890:function/add-cache-control-headers",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2021-04-08T22:46:57.566000+00:00",
                "LastModifiedTime": "2021-04-09T17:50:11.730000+00:00"
            }
        },
        "ComputeUtilization": "20",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"response\":{\"headers\":{\"server\":{\"value\":\"CustomOriginServer\"},\"content-length\":{\"value\":\"9593\"},\"content-type\":{\"value\":\"text/html; charset=UTF-8\"},\"cache-control\":{\"value\":\"public, max-age=63072000;\"}},\"statusDescription\":\"OK\",\"cookies\":{\"loggedIn\":{\"attributes\":\"Secure; Path=/; Domain=example.com; Expires=Wed, 05 Jan 2024 07:28:00 GMT\",\"value\":\"true\"},\"id\":{\"attributes\":\"Expires=Wed, 05 Jan 2024 07:28:00 GMT\",\"value\":\"a3fWa\"}},\"statusCode\":200}}"
```