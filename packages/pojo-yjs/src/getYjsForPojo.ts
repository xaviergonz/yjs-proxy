import * as Y from "yjs"
import { proxyToYjsCache } from "./cache"
import { StringKeyedObject } from "./types"
import { isObjectLike } from "./utils"

/**
 * Retrieves the underlying Yjs Map or Array from a `yjsAsPojo` proxy.
 *
 * If the value is not a `yjsAsPojo` proxy, it returns `undefined`.
 *
 * @param value The value to check.
 * @returns The underlying Yjs type or `undefined`.
 */
export function getYjsForPojo(value: any[]): Y.Array<unknown> | undefined
export function getYjsForPojo(value: StringKeyedObject): Y.Map<unknown> | undefined
export function getYjsForPojo(value: unknown): Y.Map<unknown> | Y.Array<unknown> | undefined

export function getYjsForPojo(value: any): Y.Map<unknown> | Y.Array<unknown> | undefined {
  if (!isObjectLike(value)) return undefined
  return proxyToYjsCache.get(value)
}
