## Use key-value pairs

**CloudFront Functions event type: viewer request**

The example uses key-value pairs from an Amazon CloudFront [key value store](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/kvs-with-functions.html) in a CloudFront function. 

The example shows a function that uses the content of the URL in the HTTP request to look up a custom path in the key value store. CloudFront then uses that custom path to make the request. This function helps manage the multiple paths that are part of a website. 

The example works with JavaScript runtime 2.0. The CloudFront KeyValueStore ID is optional.
