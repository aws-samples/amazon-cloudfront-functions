# Amazon CloudFront Functions

This repository contains example CloudFront functions and instructions to deploy them to CloudFront.

## Overview

[CloudFront Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html) is a serverless edge compute feature allowing you to run JavaScript code at the 225+ [Amazon CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html) edge locations for lightweight HTTP(S) transformations and manipulations. Functions is purpose-built to give you the flexibility of a full programming environment with the performance and security that modern web applications require. At a fraction of the price of [AWS Lambda@Edge](https://aws.amazon.com/lambda/edge/), CloudFront Functions can scale instantly and affordably to support millions of requests per second.

CloudFront Functions is natively built into CloudFront, allowing you to easily build, test, and deploy viewer request and viewer response functions entirely within CloudFront. This GitHub repo offers a collection of example code that can be used as a starting point for building functions. You can build functions using the IDE in the CloudFront console, or with the CloudFront APIs/CLI. Once your code is authored, you can test your function against a production CloudFront distribution, ensuring your function will execute properly once deployed. The test functionality in the console offers a visual editor to quickly create test events and validate functions. You can use CloudFront Functions in addition to the existing AWS Lambda@Edge capability that also allows you to run custom code in response to CloudFront events. 

CloudFront functions are ideal for lightweight computation tasks on web requests. Some popular use cases are:

- **HTTP header manipulation** : View, add, modify, or delete any of the request or response headers. For example, add HTTP Strict Transport Security (HSTS) headers to your response or copy the client IP address into a new HTTP header (like `True-Client-IP`) to forward this IP to the origin with the request.
- **URL rewrites and redirects** : Generate a response from within CloudFront Functions to redirect requests to a different URL. For example, redirect a non-authenticated user from a restricted page to a paywall. You could also use URL rewrites for A/B testing a website.
- **Cache key manipulations and normalization** : Transform HTTP request attributes (URL, headers, cookies, query strings) to construct the [CloudFront cache key](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-the-cache-key.html) that is used for determining cache hits on future requests. By transforming the request attributes, you can normalize multiple requests to a single cache key, leading to an improved cache hit ratio.
- **Access authorization** : Implement access control and authorization for the content delivered through CloudFront by creating and validating user-generated tokens, such as HMAC tokens or JSON web tokens (JWT), to allow or deny requests.

## Example CloudFront functions

|Example|Description|
|------|-------|
|[Add a `True-Client-IP` request header](add-true-client-ip-header/)| `True-Client-IP` is an HTTP request header that you can add to incoming CloudFront requests so that the IP address of the viewer (client) is passed along to the origin.|
|[Add HTTP security response headers](add-security-headers/)| This function adds several of the more common HTTP security headers to the response from CloudFront, including HTTP Strict Transport Security (HSTS), Content Security Policy (CSP), `X-Content-Type-Options`, `X-Frame-Options`, and `X-XSS-Protection`.|
|[Perform URL rewrite for single page applications](url-rewrite-single-page-apps/)| You can use this function to perform a URL rewrite to append "index.html" to the end of URLs that don’t include a filename or extension. This is particularly useful for single page applications or statically generated websites using frameworks like React, Angular, Vue, Gatsby, or Hugo.|
|[URL redirect based on a user’s country](redirect-based-on-country)| This function redirects a user to a country-specific version of a site based on the country of the user. In this example, if the user is in Germany, the function redirects the user to the `/de/index.html` page which is the German version of the site. If the user is not in Germany, the request passes through with no modification to the URL.|
|[Add origin request header if missing](add-origin-header/)| This function adds an origin header if it is not present on the incoming request. The origin header, part of cross-origin resource sharing (CORS), is a mechanism using HTTP headers to tell the web server which origin initiated this particular request.|
|[Verify JSON Web Tokens](verify-jwt/)| This function performs a lightweight security token validation using JSON Web Tokens. You can use this type of tokenization to give a user of your site a URL that is time-bound. Once the predetermined expiration time has occurred, the user can no longer access the content at that URL.|
|[Add CORS headers if missing](add-cors-header/)| This function adds an `Access-Control-Allow-Origin` response header if it is not present on the outgoing response from CloudFront.|
|[Add a `Cache-Control` header](add-cache-control-header/)| This function adds a `Cache-Control` response header to the outgoing response from CloudFront for browser caching.|

## Deploying a CloudFront function using the AWS CLI
We will use the example that adds cache control headers to responses as our function, but the same process can be used for all the functions with only minor changes.

**Step 1**: Install the [AWS CLI](https://aws.amazon.com/cli/). If you already have the AWS CLI, upgrade to the most recent version.

> Note: The examples below assume you are using version 2 of the AWS CLI. There are breaking changes between v1 and v2 of the AWS CLI, which can be found [here](https://docs.aws.amazon.com/cli/latest/userguide/cliv2-migration.html). In v2 of the AWS CLI, binary parameters are passed as base64-encoded strings by default. If you are using v2 of the AWS CLI, you need to do one of the following:
>
>- You can tell the AWS CLI version 2 to revert to the AWS CLI version 1 behavior by specifying the following line in the `~/.aws/config` file for a given profile: `cli_binary_format=raw-in-base64-out`
> - Pass all files using `fileb://`, which treats the file content as unencoded binary.

**Step 2**: Clone this repository.

**Step 3**: Change directories into the repo directory.
```
cd amazon-cloudfront-functions/
```

**Step 4**: Create a CloudFront function.
```
aws cloudfront create-function \
--name add-cache-control-headers \
--function-config Comment="Function to add cache-control headers",Runtime=cloudfront-js-1.0 \
--function-code fileb://add-cache-control-headers/index.js

{
    "Location": "https://cloudfront.amazonaws.com/2020-05-31/function/arn:aws:cloudfront::XXXXXXXXXXXX:function/add-cache-control-headers",
    "ETag": "EXXXXXXXXXXXX,
    "FunctionSummary": {
        "Name": "add-cache-control-headers",
        "Status": "UNPUBLISHED",
        "FunctionConfig": {
            "Comment": "Function to add cache-control headers",
            "Runtime": "cloudfront-js-1.0"
        },
        "FunctionMetadata": {
            "FunctionARN": "arn:aws:cloudfront::XXXXXXXXXXXX:function/add-cache-control-headers",
            "Stage": "DEVELOPMENT",
            "CreatedTime": "2021-04-09T22:35:57.256000+00:00",
            "LastModifiedTime": "2021-04-09T22:35:57.256000+00:
        }
    }
}
```
Make sure you capture the `ETag` value, since you will need it to publish your function.

**Step 5**: Test the CloudFront function.

To test a function, you need to pass in a JSON request or response object used to simulate a viewer request or response. A sample of the event object format can be found [here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html). This repo contains test events that you can use to test the example functions.

Test the function using the provided test event by running the following command, using the function's `ETag` (from the previous command's output) as the value for `--if-match`: 

```
aws cloudfront test-function \
--name add-cache-control-headers \ 
--if-match EXXXXXXXXX \
--event-object fileb://add-cache-control-headers/test-event.json

{
    "TestResult": {
        "FunctionSummary": {
            "Name": "add-cache-control-headers",
            "Status": "UNPUBLISHED",
            "FunctionConfig": {
                "Comment": "Function to add cache-control headers",
                "Runtime": "cloudfront-js-1.0"
            },
            "FunctionMetadata": {
                "FunctionARN": "arn:aws:cloudfront::XXXXXXXXXXXX:function/add-cache-control-headers",
                "Stage": "DEVELOPMENT",
                "CreatedTime": "2021-04-09T22:35:57.256000+00:00",
                "LastModifiedTime": "2021-04-09T22:35:57.256000+00:00"
            }
        },
        "ComputeUtilization": "16",
        "FunctionExecutionLogs": [],
        "FunctionErrorMessage": "",
        "FunctionOutput": "{\"response\":{\"headers\":{\"server\":{\"value\":\"CustomOriginServer\"},\"content-length\":{\"value\":\"9593\"},\"content-type\":{\"value\":\"text/html; charset=UTF-8\"},\"cache-control\":{\"value\":\"public, max-age=63072000;\"}},\"statusDescription\":\"OK\",\"cookies\":{\"loggedIn\":{\"attributes\":\"Secure; Path=/; Domain=example.com; Expires=Wed, 05 Jan 2024 07:28:00 GMT\",\"value\":\"true\"},\"id\":{\"attributes\":\"Expires=Wed, 05 Jan 2024 07:28:00 GMT\",\"value\":\"a3fWa\"}},\"statusCode\":200}}"
    }
}
```
The function is running successfully since we did not receive an error message and there is a `FunctionOutput` object returned. Inside the `FunctionOutput` object, we can see the `cache-control` header was added as expected.

**Step 6**: Publish your CloudFront function. 

If you received a similar response (to the one above) from the `test-function` command, you can publish the function.  

```
aws cloudfront publish-function \
--name add-cache-control-headers \
--if-match EXXXXXXXXX

{
    "FunctionSummary": {
        "Name": "add-cache-control-headers",
        "Status": "UNASSOCIATED",
        "FunctionConfig": {
            "Comment": "Function to add cache-control headers",
            "Runtime": "cloudfront-js-1.0"
        },
        "FunctionMetadata": {
            "FunctionARN": "arn:aws:cloudfront::XXXXXXXXXXXX:function/add-cache-control-headers",
            "Stage": "LIVE",
            "CreatedTime": "2021-04-09T22:35:57.256000+00:00",
            "LastModifiedTime": "2021-04-09T22:35:57.256000+00:00"
        }
    }
}
```

**Step 7**: Associate to a CloudFront distribution cache behavior.

First, get the current configuration of the distribution where you want to add the CloudFront function.

```
aws cloudfront get-distribution-config --id EXXXXXXXXXXXXX --output json > dist-cfg.json
```

Edit the JSON file (dist-cfn.json) to add a CloudFront function association. The following shows an example CloudFront function association, which you add to one of the distribution’s cache behaviors. Use the ARN of the function that you created in a previous step.

```
"FunctionAssociations": {
    "Quantity": 1,
    "Items": [
        {
            "EventType": "viewer-response",
            "FunctionARN": "arn:aws:cloudfront::XXXXXXXXXXXX:function/add-cache-control-headers"
        }
    ]
}
```

Also, make sure to change the `ETag` key name in the JSON file to `IfMatch`.

When you finish editing the JSON file, run this command to add the CloudFront function association to your distribution.

```
aws cloudfront update-distribution --id EXXXXXXXXXXXXX --cli-input-json fileb://dist-cfg.json
```

When your distribution’s status changes from `InProgress` to `Deployed` (this takes a few minutes), your CloudFront function is deployed and live at all CloudFront edge locations worldwide.

## License

This project is licensed under the Apache-2.0 License.
