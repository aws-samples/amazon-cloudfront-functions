function handler(event) {
    const request = event.request;
    const host = request.headers.host.value;
    const enforceDomainName = "www.example.com";

    if (host !== enforceDomainName) {
        const response = {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers:
            {
                location: { value: `https://${enforceDomainName}` },
            }
        }

        return response;
    }

    return request;
}