async function handler(event) {
    const response = event.response;
    const headers = response.headers;
    
    if (response.statusCode >= 200 && response.statusCode < 400) {
        // Set the cache-control header
        headers['cache-control'] = {value: 'public, max-age=63072000'};
    }
        
    // Return response to viewers
    return response;
}
