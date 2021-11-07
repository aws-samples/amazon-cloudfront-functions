## Add HTTP security headers

> :warning: Consider using [CloudFront Response Headers Policies](https://aws.amazon.com/blogs/networking-and-content-delivery/amazon-cloudfront-introduces-response-headers-policies/) instead of CloudFront Functions to configure CORS, security, and custom HTTP response headers.

**CloudFront Functions event type: viewer response**

This function adds several common HTTP security headers to the response from CloudFront. The following headers are added as part of this function:

- [HTTP Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security) is an HTTP response header (often abbreviated as HSTS) that instructs browsers to only access the website using HTTPS. Browsers will automatically convert all attempts to access the site using HTTP to HTTPS requests instead.
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) is an HTTP response header that helps detect and mitigate certain types of attacks, including Cross Site Scripting (XSS) and data injection attacks. A CSP compatible browser will then only execute scripts loaded in source files received from the allowed domains, ignoring all other scripts (including inline scripts and event-handling HTML attributes). **Important: Adjust the CSP policy to your specific needs.**
- [X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options) is an HTTP response header used to indicate that the MIME types advertised in the `Content-Type` header should be used as-is. This opts out of MIME type sniffing by asserting that the MIME types are deliberately configured.
- [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options) is an HTTP response header that indicates whether or not a browser is allowed to render a page in a `<frame>`, `<iframe>`, `<embed>` or `<object>`. Sites can use this to avoid click-jacking attacks, by ensuring that their content is not embedded into other sites. **Important: Be sure to adjust the X-Frame-Options directive to your specific needs.**
- [X-XSS-Protection](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection) is an HTTP response header feature of Internet Explorer, Chrome, and Safari that stops pages from loading when they detect reflected cross-site scripting (XSS) attacks. Although these protections are largely unnecessary in modern browsers when sites implement a strong Content Security Policy that disables the use of inline JavaScript ('unsafe-inline'), they can still provide protections for users of older web browsers that don't yet support CSP. **Important: Adjust the X-XSS-Protection directive to your specific needs.** 

**Testing the function**

To validate that the function is working as expected, you can use the provided `test-event.json` test object. To test, use the `test-function` CLI command as shown in the following example:

```
$ aws cloudfront test-function --if-match EXXXXXXXXXXXX --name add-security-headers --event-object fileb://add-security-headers/test-event.json
```

If the function has been set up correctly, you should see a result similar to the following with all the security headers being added in the `FunctionOutput` JSON object:
```
{
    "TestResult": {
        "FunctionSummary": {
            "Name": "security-headers",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "",
                "Runtime": "cloudfront-js-1.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::1234567890:function/add-security-headers",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2021-04-09T18:25:58.144000+00:00",
                "LastModifiedTime": "2021-04-09T18:25:58.303000+00:00"
            }
        },
        "ComputeUtilization": "15",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"response\":{\"headers\":{\"server\":{\"value\":\"CustomOriginServer\"},\"content-length\":{\"value\":\"9593\"},\"content-security-policy\":{\"value\":\"default-src 'none'; img-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'\"},\"x-content-type-options\":{\"value\":\"nosniff\"},\"x-xss-protection\":{\"value\":\"1; mode=block\"},\"x-frame-options\":{\"value\":\"DENY\"},\"content-type\":{\"value\":\"text/html; charset=UTF-8\"},\"strict-transport-security\":{\"value\":\"max-age=63072000; includeSubdomains; preload\"}},\"statusDescription\":\"OK\",\"cookies\":{\"loggedIn\":{\"attributes\":\"Secure; Path=/; Domain=example.com; Expires=Wed, 05 Jan 2024 07:28:00 GMT\",\"value\":\"true\"},\"id\":{\"attributes\":\"Expires=Wed, 05 Jan 2024 07:28:00 GMT\",\"value\":\"a3fWa\"}},\"statusCode\":200}}"
    }
}
```
