export function isAnyParamUppercase(...vals: string[]) {
  return vals.some(val => val === val.toUpperCase())
}
