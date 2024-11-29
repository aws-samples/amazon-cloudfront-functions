## URL rewrite to append index.html to the URI for single page applications

**CloudFront Functions event type: viewer request**

You can use this function to perform a URL rewrite to append `index.html` to the end of URLs that don't include a filename or extension. This is particularly useful for single page applications or statically-generated websites using frameworks like React, Angular, Vue, Gatsby, or Hugo. These sites are usually stored in an S3 bucket and served through CloudFront for caching. Typically, these applications remove the filename and extension from the URL path. For example, if a user went to `www.example.com/blog`, the actual file in S3 is stored at `<bucket-name>/blog/index.html`. In order for CloudFront to direct the request to the correct file in S3, you need to rewrite the URL to become `www.example.com/blog/index.html` before fetching the file from S3. This function intercepts incoming requests to CloudFront and checks that there is a filename and extension. If there isn't a filename and extension, or if the URI ends with a "/", the function appends index.html to the URI.

There is a feature in CloudFront called the [default root object](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DefaultRootObject.html) that allows you to specify an index document that applies to the root object only, but not on any subfolders. For example, if you set up index.html as the default root object and a user goes to `www.example.com`, CloudFront automatically rewrites the request to `www.example.com/index.html`. But if a user goes to `www.example.com/blog`, this request is no longer on the root directory, and therefore CloudFront does not rewrite this URL and instead sends it to the origin as is. This function handles rewriting URLs for the root directory and all subfolders. Therefore, you don't need to set up a default root object in CloudFront when you use this function (although there is no harm in setting it up).

**Note:** If you are using [S3 static website hosting](https://docs.aws.amazon.com/AmazonS3/latest/dev/WebsiteHosting.html), you don't need to use this function. S3 static website hosting allows you to set up an [index document](https://docs.aws.amazon.com/AmazonS3/latest/dev/IndexDocumentSupport.html). An index document is a webpage that Amazon S3 returns when any request lacks a filename, regardless of whether it's for the root of a website or a subfolder. This Amazon S3 feature performs the same action as this function.

## Deployment steps
### Create function

```
aws cloudfront create-function --name url-rewrite-single-page-apps --function-config Comment="Function to redirect empty doc requests to index.html",Runtime=cloudfront-js-1.0 --function-code fileb://url-rewrite-single-page-apps/index.js
```

If the function was created correctly, the JSON output should look similar to this:

```
{
    "Location": "https://cloudfront.amazonaws.com/2020-05-31/function/arn:aws:cloudfront::<account id>:function/url-rewrite-single-page-apps",
    "ETag": "EXXXXXXXXXXXX",
    "FunctionSummary": {
        "Name": "url-rewrite-single-page-apps",
        "Status": "UNPUBLISHED",
        "FunctionConfig": {
            "Comment": "Function to redirect empty doc requests to index.html",
            "Runtime": "cloudfront-js-1.0"
        },
        "FunctionMetadata": {
            "FunctionARN": "arn:aws:cloudfront::<account id>:function/url-rewrite-single-page-apps",
            "Stage": "DEVELOPMENT",
            "CreatedTime": "2021-12-26T08:43:50.950Z",
            "LastModifiedTime": "2021-12-26T08:43:50.950Z"
        }                     
    }                    
}

```
### Test the function

To validate that the function is working as expected, you can use the JSON test objects in the `test-objects` directory. To test, use the `test-function` CLI command as shown in the following example:

```
$ aws cloudfront test-function --if-match <ETag> --name url-rewrite-single-page-apps --event-object fileb://url-rewrite-single-page-apps/test-objects/file-name-no-extension.json
```

If the function has been set up correctly, you should see the `uri` being updated to `index.html` in the `FunctionOutput` JSON object:
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
        "FunctionOutput": "{\"request\":{\"headers\":{\"host\":{\"value\":\"www.example.com\"},\"accept\":{\"value\":\"text/html\"}},\"method\":\"GET\",\"querystring\":{\"test\":{\"value\":\"true\"},\"arg\":{\"value\":\"val1\"}},\"uri\":\"/blog/index.html\",\"cookies\":{\"loggedIn\":{\"value\":\"false\"},\"id\":{\"value\":\"CookeIdValue\"}}}}"
    }
}
```

### Publish the function.
Please note that the JSON response states `"Status" : "UNPUBLISHED"`, so the next step is to publish the function.
```
aws cloudfront publish-function --name url-rewrite-single-page-apps --if-match <ETag>
```
And - if successful - JSON response should look similar to:

```
{
    "FunctionSummary": {
        "Name": "url-rewrite-single-page-apps",
        "Status": "UNASSOCIATED",
        "FunctionConfig": {
            "Comment": "Function to redirect empty doc requests to index.html",
            "Runtime": "cloudfront-js-1.0"
        },
        "FunctionMetadata": {
            "FunctionARN": "arn:aws:cloudfront::<account id>:function/url-rewrite-single-page-apps",
            "Stage": "LIVE",
            "CreatedTime": "2021-12-26T08:47:42.111Z",
            "LastModifiedTime": "2021-12-26T08:47:42.111Z"
        }
    }
}

```
### Configuration of the function.
Since it's created and published, now it needs to be configured.

```
aws cloudfront get-distribution-config --id <distribution name, NOT ETag!> --output json > dist-cfg.json
```
Edit the `dist-cfg.json`:

* Change the `ETag` key to `IfMatch`
* Modify `FunctionAssociation` to the following:

```
"FunctionAssociations": {
                "Quantity": 1,
                "Items" : [     
                        {
                        "EventType" : "viewer-request",
                        "FunctionARN":"arn:aws:cloudfront::<account id>:function/url-rewrite-single-page-apps"
                }
                ]

            },

```
### Modify CloudFront distribution by adding `ETag`.
Distributions->Distribution ID->Origins->Edit->Add custom header - optional
Add `ETag`, value `EXXXXXXXXXXXX`

### Update the distribution

```
aws cloudfront update-distribution --id  <CF Distribution ID> --cli-input-json fileb://dist-cfg.json
```
