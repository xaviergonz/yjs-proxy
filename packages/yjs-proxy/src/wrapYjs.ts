import * as Y from "yjs"
import { yarrayProxy } from "./arrayProxy"
import { failure } from "./error/failure"
import { ymapProxy } from "./mapProxy"
import { StringKeyedObject } from "./types"
import { isYArray, isYMap } from "./utils"

/**
 * Wraps a Yjs Map or Array in a Proxy that allows it to be treated as a plain JavaScript object or array.
 *
 * Mutations to the proxy are automatically applied to the underlying Yjs type within a transaction.
 * Nested Yjs types are automatically wrapped in proxies when accessed.
 *
 * @param yType The Yjs Map or Array to wrap.
 * @returns A proxy that behaves like a plain JS object or array.
 */
export function wrapYjs<T extends any[]>(yArray: Y.Array<any>): T
export function wrapYjs<T extends StringKeyedObject>(yMap: Y.Map<any>): T
export function wrapYjs<T>(yType: Y.Map<any> | Y.Array<any>): T

export function wrapYjs<T>(yType: Y.Map<any> | Y.Array<any>): T {
  if (isYMap(yType)) return ymapProxy(yType) as unknown as T
  if (isYArray(yType)) return yarrayProxy(yType) as unknown as T
  throw failure("wrapYjs only supports Y.Map and Y.Array")
}
