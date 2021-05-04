function handler(event) {
    var response = event.response;
    var headers = response.headers;
    
    // Set the cache-control header
     headers['cache-control'] = {value: 'public, max-age=63072000;'};
        
    // Return response to viewers
    return response;
}