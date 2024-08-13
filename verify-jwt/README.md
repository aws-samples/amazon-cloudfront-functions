## Verify a JSON Web Token (JWT) using SHA256 HMAC signature

**CloudFront Functions event type: viewer request**

**Note:** We recommend using the [kvs-jwt-verify example](https://github.com/aws-samples/amazon-cloudfront-functions/tree/main/kvs-jwt-verify) instead. It uses Amazon CloudFront KeyValueStore to store the secret key, and is compatible with JavaScript 2.0 runtime. 

This function validates a JSON Web Token (JWT) in the query string of the incoming request. JWT is an open, industry standard [RFC 7519](https://tools.ietf.org/html/rfc7519) method for representing claims securely between two parties. You can use JWTs to validate that a viewer has the right access to view the content being requested. You can use this type of tokenization to give a user of your site a URL that is time bound. Once the predetermined expiry time is reached, the user no longer has access to the content on that URL.

This function has two components. First, your origin or application must be able to generate a JWT and append that token as a query string to the URL. Second, you must use this sample function (or some variation of this function) on a viewer request event type to validate the JWT in the query string, ensuring that the URL hasn't been changed or tampered with and the expiry time hasn't passed. If the token is valid and the expiry time hasn't passed, the request passes through to CloudFront and the request is served. If the token is invalid or the expiry time has passed, the function generates and serves a 401 Unauthorized response to the viewer.

In this example, your origin or application establish a JWT. We have provided a simple bash script for building a JWT called `generate-jwt.sh`. There are many libraries across multiple different languages for signing and verifying JWTs available on [jwt.io](https://jwt.io/). 

The output of `generate-jwt.sh` is the JWT that the function will validate. Append the output to the URL as a query string in the following format `token=<generated JWT>` (e.g. `token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJuYmYiOjE1MTYyMzkwMjIsImV4cCI6MTcxNjIzOTAyMn0.jyu6HjS95wU8iSofQ8nBlmPjFYODxn4PQAdFM-Cv8JY`).

CloudFront already provides a [signed URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html) feature that you can use instead of this function. A signed URL can include additional information, such as an expiration date and time, start date and time, and client IP address, which gives you more control over access to your content. However, creating a signed URL creates long and complex URLs and is more computationally costly to produce. If you need a simple and lightweight way to validate time bound URLs, this function can be easier than using CloudFront signed URLs.

**Testing the function**

To validate that the function is working as expected, you can use the JSON test objects in the `test-objects` directory. To test, you can use the `test-function` CLI command as shows in the following example:

```
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name verify-jwt --event-object fileb://verify-jwt/test-objects/valid-jwt.json
```

If the function has been set up correctly, you should see a log entry saying the token is valid in the `FunctionExecutionLogs` and JWT token removed in the `FunctionOutput` JSON object:
```
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "verify-jwt",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-1.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::1234567890:function/verify-jwt",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2021-04-09T22:02:12.937000+00:00",
                "LastModifiedTime": "2021-04-09T22:09:19.277000+00:00"
            }
        },
        "ComputeUtilization": "19",
        "FunctionExecutionLogs": [
            "Valid JWT token"
        ],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"request\":{\"headers\":{\"host\":{\"value\":\"www.example.com\"},\"accept\":{\"value\":\"text/html\"}},\"method\":\"GET\",\"querystring\":{\"test\":{\"value\":\"anotherQueryString\"}},\"uri\":\"/index.html\",\"cookies\":{}}}"
    }
}
```
