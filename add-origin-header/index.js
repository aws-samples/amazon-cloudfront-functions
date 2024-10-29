async function handler(event) {
    const request = event.request;
    const headers = request.headers;
    const host = request.headers.host.value;
   
   // If origin header is missing, set it equal to the host header.
   if (!headers.origin)
       headers.origin = {value:`https://${host}`};
       
   return request;
}
