import { YjsProxyError } from "./YjsProxyError"

export function failure(msg: string) {
  return new YjsProxyError(msg)
}
