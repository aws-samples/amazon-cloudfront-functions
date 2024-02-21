function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Check whether the URI is missing a file extension.
    if (!uri.includes('.')) {
        request.uri = '/index.html';
    }

    return request;
}