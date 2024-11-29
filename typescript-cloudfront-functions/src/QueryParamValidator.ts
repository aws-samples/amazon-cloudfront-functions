import { error, INVALID_PARAM_MSG, MISSING_REQUIRED_PARAM_MSG } from './utils/ErrorHandling'
import { isAnyParamUppercase } from './utils/StringUtils'

/**
 * This example function is for a viewer request event trigger
 * It rejects requests that have uppercase values for the required query parameters
 */
export default function handler(
  event: AWSCloudFrontFunction.Event
): AWSCloudFrontFunction.Request | AWSCloudFrontFunction.Response {
  const request = event.request
  const param1 = request.querystring.param1?.value
  const param2 = request.querystring.param2?.value

  if (param1 === undefined || param2 === undefined)
    return error(400, MISSING_REQUIRED_PARAM_MSG)
  else if (isAnyParamUppercase(param1, param2))
    return error(400, INVALID_PARAM_MSG)

  return event.request
}
