/**
 * Given a URI this will return the suffix which should be appended in cases where the URI does not include a filename or extension.
 * @see https://github.com/aws-samples/amazon-cloudfront-functions/tree/main/url-rewrite-single-page-apps
 */
function uriSuffix(uri) {
    // Iterate over the given URI in reverse order looking for '/' or '.' as a means to determine if the
    // last path element represents a file (indicated by a file extension).
    var count = uri.length - 1;
    for (var indx = count; indx >= 0; --indx) {
        var achar = uri[indx];
        // If we find a '/' append 'index.html' as the last path element
        if (achar === '/') {
            return indx === count ? 'index.html' : '/index.html';
        }
        // Otherwise if we find a '.' we assume the last path element is a file and return empty string
        // (no URI modification needed).
        else if (achar === '.') {
            return '';
        }
    }

    // If we did not encounter a '/' or '.', default.
    return '/index.html';
}

function handler(event) {
    var request = event.request;
    var suffix = uriSuffix(request.uri);
    if (suffix.length) {
        request.uri += suffix;
    }

    return request;
}