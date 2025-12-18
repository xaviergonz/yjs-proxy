import * as Y from "yjs"
import { isPlainObject } from "./utils"
import { StringKeyedObject } from "./types"
import {
  convertJsToYjsValue,
} from "./conversion"
import { getYjsForPojo } from "./getYjsForPojo"
import { failure } from "./error/failure"

/**
 * Converts a plain JavaScript value (object, array, primitive) or a `yjsAsPojo` proxy
 * into its corresponding Yjs type.
 *
 * - If the value is already a Yjs type, it is returned as-is.
 * - If the value is a `yjsAsPojo` proxy, the underlying Yjs type is returned.
 * - If the value is a plain object or array, it is recursively converted to `Y.Map` or `Y.Array`.
 *
 * @param value The value to convert.
 * @returns The corresponding Yjs type.
 * @throws PojoYjsError if the value cannot be converted to a Yjs Map or Array.
 */
export function pojoToYjs(value: any[]): Y.Array<unknown>
export function pojoToYjs(value: StringKeyedObject): Y.Map<unknown>
export function pojoToYjs(value: object): Y.Map<unknown> | Y.Array<unknown>

export function pojoToYjs(value: any): Y.Map<unknown> | Y.Array<unknown> {
  const unwrapped = getYjsForPojo(value)
  if (unwrapped) return unwrapped

  if (value instanceof Y.Map || value instanceof Y.Array) return value

  if (Array.isArray(value)) {
    const yarr = new Y.Array<unknown>()
    const seen = new WeakSet<object>()
    const converted = value.map((v) => convertJsToYjsValue(v, yarr, seen))
    yarr.insert(0, converted)
    return yarr
  }

  if (isPlainObject(value)) {
    const ymap = new Y.Map<unknown>()
    const seen = new WeakSet<object>()
    for (const [k, v] of Object.entries(value)) {
      ymap.set(k, convertJsToYjsValue(v, ymap, seen))
    }
    return ymap
  }

  throw failure("Value cannot be converted to a Yjs Map or Array")
}
