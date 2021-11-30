## Redirect (temporary) to new domain

**CloudFront Functions event type: viewer response**

This function will perform a redirect (302 - temporary) to a new domain while maintaining the uri and query string values in the destination FQDN.

If you want a permanent redirect,  change statusCode from 302 to 301 in function code.

**Important: Set the `newdomain` variable to an appropriate value for your specific needs.**

**Testing the function**

To validate that the function is working as expected, you can use the provided test object from https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html#functions-event-structure-example and test in the console using the instructions https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/test-function.html#test-function-console

If the function has been set up correctly, you should see a result similar to the following with the value of 'newdomain',  and the uri and querystring values from the test object being added in the 'location' response header in `FunctionOutput` JSON object:
```
{
  "response": {
    "headers": {
      "location": {
        "value": "https://newdomain.com/media/index.mpd?ID=42&Exp=1619740800&TTL=1440&querymv=val1,val2,val3"
      }
    },
    "statusDescription": "Found",
    "cookies": {},
    "statusCode": 302
  }
  ...
