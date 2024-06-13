export const validRequest: AWSCloudFrontFunction.Request = {
  method: 'GET',
  uri: '/test',
  querystring: {
    param1: { value: 'val1' },
    param2: { value: 'val2' }
  },
  headers: {},
  cookies: {}
}

export const invalidRequest: AWSCloudFrontFunction.Request = {
  method: 'GET',
  uri: '/test',
  querystring: {
    param1: { value: 'VAL1' },
    param2: { value: 'VAL2' }
  },
  headers: {},
  cookies: {}
}

const sampleContext: AWSCloudFrontFunction.Context = {
  eventType: 'viewer-response',
  distributionDomainName: '',
  distributionId: '',
  requestId: ''
}

const sampleViewer: AWSCloudFrontFunction.Viewer = {
  ip: '192.168.1.1'
}

const sampleResponse: AWSCloudFrontFunction.Response = {
  statusCode: 200,
  statusDescription: 'OK',
  headers: {},
  cookies: {}
}

export const validCloudFrontFunctionEvent: AWSCloudFrontFunction.Event = {
  version: '1.0',
  request: validRequest,
  context: sampleContext,
  viewer: sampleViewer,
  response: sampleResponse
}

export const invalidCloudFrontFunctionEvent: AWSCloudFrontFunction.Event = {
  version: '1.0',
  request: invalidRequest,
  context: sampleContext,
  viewer: sampleViewer,
  response: sampleResponse
}
