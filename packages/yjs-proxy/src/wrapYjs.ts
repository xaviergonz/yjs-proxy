import * as Y from "yjs"
import { yarrayProxy } from "./arrayProxy"
import { failure } from "./error/failure"
import { ymapProxy } from "./mapProxy"
import { StringKeyedObject, YjsProxiableValue } from "./types"
import { isYjsValueDeleted } from "./utils"

/**
 * Wraps a Y.js Map or Array in a Proxy that allows it to be treated as a plain JavaScript object or array.
 *
 * Mutations to the proxy are automatically applied to the underlying Y.js value within a transaction.
 * Nested Y.js values are automatically wrapped in proxies when accessed.
 *
 * @param yjsValue The Y.js Map or Array to wrap.
 * @returns A proxy that behaves like a plain JS object or array.
 * @throws {YjsProxyError} If the Y.js value is deleted or if it's not a Y.Map or Y.Array.
 */
export function wrapYjs<T extends any[]>(yArray: Y.Array<any>): T
export function wrapYjs<T extends StringKeyedObject>(yMap: Y.Map<any>): T
export function wrapYjs<T>(yjsValue: YjsProxiableValue): T

export function wrapYjs<T>(yjsValue: YjsProxiableValue): T {
  if (isYjsValueDeleted(yjsValue)) {
    throw failure("Cannot wrap a deleted Y.js value")
  }

  if (yjsValue instanceof Y.Map) {
    return ymapProxy(yjsValue) as unknown as T
  } else if (yjsValue instanceof Y.Array) {
    return yarrayProxy(yjsValue) as unknown as T
  } else {
    throw failure("wrapYjs only supports Y.Map and Y.Array")
  }
}
