function handler(event)  {
    var request = event.request;
    var response  = event.response;
 
    // If Access-Control-Allow-Origin CORS header is missing, add it.
    // Since JavaScript doesn't allow for hyphens in variable names, we use the dict["key"] notation.
    if (!response.headers['access-control-allow-origin'] && request.headers['origin']) {
        response.headers['access-control-allow-origin'] = {value: request.headers['origin'].value};
        console.log("Access-Control-Allow-Origin was missing, adding it now.");
    }

    return response;
}

