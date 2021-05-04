## Add True-Client-IP header

**CloudFront Functions event type: viewer request**

`True-Client-IP` is a request HTTP header that you can add to incoming CloudFront requests to include the IP address of a client connecting to CloudFront. Without this header, connections from CloudFront to your origin contain the IP address of the CloudFront server making the request to your origin, not the IP address of the client connected to CloudFront. This CloudFront function adds the `True-Client-IP` HTTP header to the incoming CloudFront request so your origin has access to the IP address of the client connecting to CloudFront.

**Important: You must add this header to the allowed list of headers forwarded to the origin as part of a [CloudFront origin request policy](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-origin-requests.html#origin-request-understand-origin-request-policy-settings). Otherwise, CloudFront removes this header before making the request to the origin.**

**Note:**
- You only need this header if your origin includes logic based on the client's IP address. If your origin returns the same content regardless of the client IP address, this function is likely not needed.
- You don't have to use the header name `True-Client-IP`. You can change the name to any value that your origin requires (e.g. `X-Real-IP`).
- CloudFront also sends an `X-Forwarded-For` header to your origin, which contains the client's IP address along with any HTTP proxies or load balancers that the request passed through.

**Testing the function**

To validate that the function is working as expected, you can use the provided `test-event.json` test object. To test, you can use the `test-function` CLI command as shown in the following example:

```
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name add-true-client-ip-header --event-object fileb://add-true-client-ip-header/test-event.json
```

If the function has been correctly setup, you should see a similar result with the `true-client-ip` header being added in the `FunctionOutput` JSON object:
```
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "add-true-client-ip-header",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-1.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::1234567890:function/add-true-client-ip-header",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2021-04-09T18:32:18.865000+00:00",
                "LastModifiedTime": "2021-04-09T18:33:37.336000+00:00"
            }
        },
        "ComputeUtilization": "10",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"request\":{\"headers\":{\"true-client-ip\":{\"value\":\"0.0.0.0\"},\"host\":{\"value\":\"www.example.com\"},\"accept\":{\"value\":\"text/html\"}},\"method\":\"GET\",\"querystring\":{\"test\":{\"value\":\"true\"},\"arg\":{\"value\":\"val1\"}},\"uri\":\"/index.html\",\"cookies\":{\"loggedIn\":{\"value\":\"false\"},\"id\":{\"value\":\"CookeIdValue\"}}}}"
    }
}
```