## Preserve Query Strings on Redirect

**CloudFront Functions event type: viewer request**

This function provides an example of how to preserve query strings when performing a redirect.

**Testing the function**

To validate that the function is working as expected, you can use the JSON test objects in the `test-objects` directory. To test, use the `test-function` CLI command as shown in the following examples:

**Preserve Query Strings**

This test validates that requests with query strings will be redirected to the `www.example.com` domain preserving the requested URL and query strings.

```shell
# Get the current ETag value
$ aws cloudfront describe-function --name preserve-query-strings-on-redirect
# Run the test
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name preserve-query-strings-on-redirect --event-object fileb://preserve-query-strings-on-redirect/test-objects/query-strings.json
```

If the function has been set up correctly, you should see a result similar to the following with the redirect being issued (`location` header being returned) in the `FunctionOutput` JSON object. Notice that the requested URL and query strings are included in the `value`:

```json
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "preserve-query-strings-on-redirect",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-2.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::060232822672:function/preserve-query-strings-on-redirect",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2024-10-02T14:08:21.623000+00:00",
                "LastModifiedTime": "2024-10-02T14:08:44.844000+00:00"
            }
        },
        "ComputeUtilization": "10",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"response\":{\"headers\":{\"location\":{\"value\":\"https://www.example.com/example-page?name=example-name&test=example-test-query-string&querymv=val1&querymv=val2,val3\"}},\"statusDescription\":\"Moved Permanently\",\"cookies\":{},\"statusCode\":301}}"
    }
}
```

**Redirect still works when no query strings in request**

```shell
# Get the current ETag value
$ aws cloudfront describe-function --name preserve-query-strings-on-redirect
# Run the test
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name preserve-query-strings-on-redirect --event-object fileb://preserve-query-strings-on-redirect/test-objects/no-query-strings.json
```

If the function has been set up correctly, you should see a result similar to the following with the redirect being issued (`location` header being returned) in the `FunctionOutput` JSON object. Notice that the requested URL is included in the `value`:

```json
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "preserve-query-strings-on-redirect",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-2.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::060232822672:function/preserve-query-strings-on-redirect",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2024-10-02T14:08:21.623000+00:00",
                "LastModifiedTime": "2024-10-02T14:08:44.844000+00:00"
            }
        },
        "ComputeUtilization": "7",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"response\":{\"headers\":{\"location\":{\"value\":\"https://www.example.com/example-page\"}},\"statusDescription\":\"Moved Permanently\",\"cookies\":{},\"statusCode\":301}}"
    }
}
```
