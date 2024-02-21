import handler from '../src/QueryParamValidator'
import {
  invalidCloudFrontFunctionEvent,
  validCloudFrontFunctionEvent,
  validRequest
} from './mocks/MockCloudFrontEvent'

describe('Query Param Validator', () => {
  it('Should not reject requests with lowercase params', () => {
    const result = handler(validCloudFrontFunctionEvent)
    expect(result).toEqual(validRequest)
  })

  it('Should reject requests with uppercase params', () => {
    const result = handler(invalidCloudFrontFunctionEvent)
    expect((result as AWSCloudFrontFunction.Response).statusCode).toEqual(400)
  })
})
