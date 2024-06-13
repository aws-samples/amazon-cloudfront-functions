## URL redirect to index.html for single page applications

**CloudFront Functions event type: viewer request**

You can use this function to perform a URL redirect to `index.html` for URLs that don't include an extension. This is particularly useful for single page applications using frameworks like Vue.js, React, or Angular. These applications are usually stored in an S3 bucket and served through CloudFront for caching. Tipically, these applications redirect all traffic to a single index.html page for handling by a client-side router function. For example, if a user requests `www.example.com/blog`, the actual file in S3 is stored at `<bucket-name>/index.html`. In order for CloudFront to direct the request to the correct file in S3, you need to rewrite the URL to become `www.example.com/index.html` before fetching the file from S3. This function intercepts incoming requests to CloudFront and checks that there is an extension. If there isn't an extension, the function redirects to the index.html stored in the root of the bucket.

**Testing the function**

To validate that the function is working as expected, you can use the JSON test objects in the `test-objects` directory. To test, use the `test-function` CLI command as shown in the following example:

```
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name url-rewrite-single-page-apps --event-object fileb://url-rewrite-single-page-apps/test-objects/file-name-no-extension.json
```

If the function has been set up correctly, you should see the `uri` being changed to `index.html` in the `FunctionOutput` JSON object:

```
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "url-rewrite-single-page-apps",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-1.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::1234567890:function/url-rewrite-single-page-apps",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2021-04-09T21:53:20.882000+00:00",
                "LastModifiedTime": "2021-04-09T21:53:21.001000+00:00"
            }
        },
        "ComputeUtilization": "14",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"request\":{\"headers\":{\"host\":{\"value\":\"www.example.com\"},\"accept\":{\"value\":\"text/html\"}},\"method\":\"GET\",\"querystring\":{\"test\":{\"value\":\"true\"},\"arg\":{\"value\":\"val1\"}},\"uri\":\"/index.html\",\"cookies\":{\"loggedIn\":{\"value\":\"false\"},\"id\":{\"value\":\"CookeIdValue\"}}}}"
    }
}
```
