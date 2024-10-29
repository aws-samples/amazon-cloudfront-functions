async function handler(event) {
    var request = event.request;
    var headers = request.headers;
    var host = request.headers.host.value;
   
   // If origin header is missing, set it equal to the host header.
   if (!headers.origin)
       headers.origin = {value:`https://${host}`};
       
   return request;
}
