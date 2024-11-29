function objectToQueryString(obj) {
    var str = [];
    for (var param in obj)
        if (obj[param].multiValue)
            str.push(param + "=" + obj[param].multiValue.map((item) => item.value).join(','));
        else if (obj[param].value == '')
            str.push(param);
        else
            str.push(param + "=" + obj[param].value);

    return str.join("&");
}

function handler(event) {
    var request = event.request;
    var headers = request.headers;
    var uri = request.uri;
    var loc = "";
    var newdomain = "newdomain.com";

    if (Object.keys(request.querystring).length) 
        loc = `https://${newdomain}${uri}?${objectToQueryString(request.querystring)}`
    else 
        loc = `https://${newdomain}${uri}`

    var response = {
        statusCode: 302,
        statusDescription: 'Found',
        headers: {
            'location': { value: `${loc}` }      
        }
    };
    return response;
}
