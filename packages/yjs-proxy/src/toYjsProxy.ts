import rfdc from "rfdc"
import { createYArrayProxy } from "./arrayProxy"
import { isYjsProxy } from "./cache"
import { createYMapProxy } from "./mapProxy"
import { isMarkedAsJs } from "./markAsJs"
import { isObjectLike } from "./utils"

const clone = rfdc()

/**
 * Options for `toYjsProxy`.
 */
export interface ToYjsProxyOptions {
  /**
   * Whether to deep clone the input value.
   * If `true` (default), the input value is deep cloned into the proxy.
   * If `false`, the input value is used as the initial JSON data for the proxy,
   * meaning mutations to the proxy while detached will affect the original object.
   */
  clone?: boolean
}

/**
 * Converts a plain JavaScript object or array into a proxied Y.js value.
 *
 * The returned proxy starts in "detached mode" (detached from any Y.js document).
 *
 * When this proxy is assigned to a property of another Y.js proxy, it will be
 * automatically converted to a real Y.js value and attached to the document.
 *
 * @param val The plain JavaScript object or array to convert.
 * @param options Options for the conversion.
 * @returns A Y.js proxy in detached mode.
 */
export function toYjsProxy<T extends object>(val: T, options?: ToYjsProxyOptions): T {
  if (isYjsProxy(val)) {
    return val
  }

  const shouldClone = options?.clone ?? true

  const actualVal = shouldClone ? clone(val) : val

  const proxy = Array.isArray(actualVal)
    ? createYArrayProxy({ attached: false, json: actualVal })
    : createYMapProxy({ attached: false, json: actualVal })

  const innerOptions = { ...options, clone: false }
  for (const key of Object.keys(actualVal)) {
    const value = (actualVal as any)[key]
    if (isObjectLike(value) && !isMarkedAsJs(value)) {
      // We already cloned the whole tree if shouldClone was true,
      // so we don't need to clone again in nested calls.
      const childProxy = toYjsProxy(value as any, innerOptions)
      ;(proxy as any)[key] = childProxy
    }
  }

  return proxy as T
}
