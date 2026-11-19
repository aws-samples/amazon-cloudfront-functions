function handler(event) {
    const request = event.request;
    const uri = request.uri;
    const customRedirectLogic = true;
    var queryStringAsString = '';

    const qs = []
    for (const key in request.querystring) {
      if (request.querystring[key].multiValue) {
        request.querystring[key].multiValue.forEach((mv) => { qs.push(key + '=' + mv.value) })
      } else {
        qs.push(key + '=' + request.querystring[key].value)
      }
    }
  
    if (qs.length !== 0) {
      queryStringAsString = '?' + qs.join('&')
    }
  
    if (customRedirectLogic) {
        const response = {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers:
            {
                location: { value: `https://www.example.com${uri}${queryStringAsString}` },
            }
        }

        return response;
    }

    return request;
}