## URL redirect to the county-specific version of a site

**CloudFront Functions event type: viewer request**

This function redirects a user to a country-specific version of a site based on the country of the user. For example, if the user is in Germany, the function redirects the user to the `/de/index.html` page which is the Germany-specific version of the site. If the user is not in Germany, the request passes through with no modification to the URL.

This function makes use of the `Cloudfront-Viewer-Country` [geo-location header](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-cloudfront-headers.html#cloudfront-headers-viewer-location) which performs a lookup on the request to determine the user's country and includes that value in the `Cloudfront-Viewer-Country` request header. You can use any of the geo-location or [device detection](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-cloudfront-headers.html#cloudfront-headers-device-type) headers that are available from CloudFront. For the geo-location or device detection headers to appear in the request object within a function, you must allow these headers (or allow all viewer headers) in a CloudFront [origin request policy](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-origin-requests.html#origin-request-understand-origin-request-policy) or [cache policy](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html#cache-key-understand-cache-policy).

**Testing the function**

To validate that the function is working as expected, you can use the JSON test objects in the `test-objects` directory. To test, use the `test-function` CLI command as shown in the following example:

```
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name redirect-based-on-country --event-object fileb://redirect-based-on-country/test-objects/country-de.json
```

If the function has been set up correctly, you should see a result similar to the following with the redirect being issued (`location` header being returned) in the `FunctionOutput` JSON object:
```
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "redirect-based-on-country",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-1.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::1234567890:function/redirect-based-on-country",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2021-04-09T21:23:53.921000+00:00",
                "LastModifiedTime": "2021-04-09T21:36:14.177000+00:00"
            }
        },
        "ComputeUtilization": "13",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"response\":{\"headers\":{\"location\":{\"value\":\"https://www.example.com/de/index.html\"}},\"statusDescription\":\"Found\",\"cookies\":{},\"statusCode\":302}}"
    }
}
```