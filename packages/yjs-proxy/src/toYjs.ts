import * as Y from "yjs"
import { convertJsToYjsValue } from "./conversion"
import { failure } from "./error/failure"
import { StringKeyedObject } from "./types"
import { unwrapYjs } from "./unwrapYjs"
import { isYArray, isYMap } from "./utils"

/**
 * Converts a plain JavaScript value (object, array, primitive) or a `wrapYjs` proxy
 * into its corresponding Yjs type.
 *
 * - If the value is already a Yjs type, it is returned as-is.
 * - If the value is a `wrapYjs` proxy, the underlying Yjs type is returned.
 * - If the value is a plain object or array, it is recursively converted to `Y.Map` or `Y.Array`.
 *
 * @param value The value to convert.
 * @returns The corresponding Yjs type.
 * @throws YjsProxyError if the value cannot be converted to a Yjs Map or Array.
 */
export function toYjs(value: any[]): Y.Array<unknown>
export function toYjs(value: StringKeyedObject): Y.Map<unknown>
export function toYjs(value: object): Y.Map<unknown> | Y.Array<unknown>

export function toYjs(value: any): Y.Map<unknown> | Y.Array<unknown> {
  const unwrapped = unwrapYjs(value)
  if (unwrapped) return unwrapped

  if (value instanceof Y.Map || value instanceof Y.Array) return value

  const converted = convertJsToYjsValue(value)
  if (isYMap(converted) || isYArray(converted)) {
    return converted
  }

  throw failure("Value cannot be converted to a Yjs Map or Array")
}
