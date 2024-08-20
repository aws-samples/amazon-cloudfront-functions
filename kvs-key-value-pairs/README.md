## Use key-value pairs

**CloudFront Functions event type: viewer request**

The example uses key-value pairs from an Amazon CloudFront [KeyValueStore](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/kvs-with-functions.html) in a CloudFront function. 

The example shows a function that uses the content of the URL in the HTTP request to look up a custom path in the key value store. CloudFront then uses that custom path to make the request. This function helps manage the multiple paths that are part of a website, such as updating the version of a blog platform on a website. For example, if the earlier blog has origin path ```/blog-v1``` and the new blog has origin path ```/blog-v2```, this function can look up the URL path of the incoming request and rewrite the URL path ```(/blog-v1)``` to the new version of the blog ```(/blog-v2)```.

The example works with [JavaScript runtime 2.0](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-javascript-runtime-20.html).
