export const error = (statusCode: number, statusDescription: string) => ({
  statusCode,
  statusDescription
})

export const MISSING_REQUIRED_PARAM_MSG = 'Required parameter is missing'
export const INVALID_PARAM_MSG = 'Invalid parameter'
