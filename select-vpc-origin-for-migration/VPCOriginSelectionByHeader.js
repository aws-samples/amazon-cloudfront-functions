import cf from 'cloudfront';

const kvsHandle = cf.kvs();

// Configuration: Update these values to match your CloudFront distribution origins
const PUBLIC_ORIGIN_DOMAIN = 'your-public-origin.example.com';  // Replace with your public origin domain
const PRIVATE_ORIGIN_ID = 'your-private-origin-id';              // Replace with your private VPC origin ID

async function handler(event) {
    const request = event.request;
    
    try {
        const config = await kvsHandle.get('routing_mode', { format: 'json' });
        
        if (config.mode === 'header') {
            const routeHeader = request.headers['x-route-origin'];
            if (routeHeader && routeHeader.value === 'public') {
                cf.updateRequestOrigin({
                    domainName: PUBLIC_ORIGIN_DOMAIN
                });
            } else if (routeHeader && routeHeader.value === 'private') {
                cf.selectRequestOriginById(PRIVATE_ORIGIN_ID);
            }
        } else if (config.mode === 'weighted') {
            const hash = simpleHash(event.viewer.ip);
            if (hash % 100 < config.weight_percentage) {
                cf.selectRequestOriginById(PRIVATE_ORIGIN_ID);
            } else {
                cf.updateRequestOrigin({
                    domainName: PUBLIC_ORIGIN_DOMAIN
                });
            }
        }
    } catch (error) {
        console.log('Routing error: ' + error);
    }
    
    return request;
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}