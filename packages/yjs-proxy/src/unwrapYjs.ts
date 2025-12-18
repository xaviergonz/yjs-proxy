import * as Y from "yjs"
import { proxyToYjsCache } from "./cache"
import { StringKeyedObject } from "./types"
import { isObjectLike } from "./utils"

/**
 * Retrieves the underlying Yjs Map or Array from a `wrapYjs` proxy.
 *
 * If the value is not a `wrapYjs` proxy, it returns `undefined`.
 *
 * @param value The value to check.
 * @returns The underlying Yjs type or `undefined`.
 */
export function unwrapYjs(value: any[]): Y.Array<unknown> | undefined
export function unwrapYjs(value: StringKeyedObject): Y.Map<unknown> | undefined
export function unwrapYjs(value: unknown): Y.Map<unknown> | Y.Array<unknown> | undefined

export function unwrapYjs(value: any): Y.Map<unknown> | Y.Array<unknown> | undefined {
  if (!isObjectLike(value)) return undefined
  return proxyToYjsCache.get(value)
}
