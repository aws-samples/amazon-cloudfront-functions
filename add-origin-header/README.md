## Add Origin header if missing

**CloudFront Functions event type: viewer request**

This function adds an [origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin) header if it is not present in the incoming request. The `Origin` header is part of [Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) (CORS), a mechanism using HTTP headers to tell browsers to give a web application running at one origin access to selected resources from a different origin.

In order for your origin to receive the `Origin` header, you must specifically allow the `Origin` header (or allow all viewer headers) in a CloudFront [origin request policy](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-origin-requests.html#origin-request-understand-origin-request-policy). Without adding this header in an origin request policy, CloudFront removes the `Origin` header before sending requests to your origin.

If you origin doesn't respond with CORS headers (e.g. the Access-Control-Allow-Origin header), then this function is not required.

**Testing the function**

To validate that the function is working as expected, you can use the JSON test objects in the `test-objects` directory. To test, you can use the `test-function` CLI command that will look something like this:

```
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name add-origin-header --event-object fileb://add-origin-header/test-objects/no-origin-header.json
```

If the function has been correctly setup, you should see a similar result with the `origin` header being added in the `FunctionOutput` JSON object:
```
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "add-origin-header",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-1.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::1234567890:function/add-origin-header",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2021-04-09T18:14:49.648000+00:00",
                "LastModifiedTime": "2021-04-09T18:20:08.058000+00:00"
            }
        },
        "ComputeUtilization": "15",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"request\":{\"headers\":{\"origin\":{\"value\":\"https://www.example.com\"},\"host\":{\"value\":\"www.example.com\"},\"accept\":{\"value\":\"text/html\"}},\"method\":\"GET\",\"querystring\":{\"test\":{\"value\":\"true\"},\"arg\":{\"value\":\"val1\"}},\"uri\":\"/index.html\",\"cookies\":{\"loggedIn\":{\"value\":\"false\"},\"id\":{\"value\":\"CookeIdValue\"}}}}"
    }
}
```
