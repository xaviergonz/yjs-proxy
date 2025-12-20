import * as Y from "yjs"
import { convertJsToYjsValue } from "./conversion"
import { failure } from "./error/failure"
import { StringKeyedObject } from "./types"
import { tryUnwrapYjs } from "./unwrapYjs"

/**
 * Converts a plain JavaScript value (object, array, primitive) into its corresponding Y.js value.
 *
 * - If the value is a plain object or array, it is recursively converted to `Y.Map` or `Y.Array`.
 * - If the value is already a Y.js value or a `yjs-proxy` proxy, it throws a failure.
 *
 * @param value The value to convert.
 * @returns The corresponding Y.js value.
 * @throws YjsProxyError if the value cannot be converted to a Y.js Map or Array,
 *         or if it is already a Y.js value or a proxy.
 */
export function toYjs(value: any[]): Y.Array<unknown>
export function toYjs(value: StringKeyedObject): Y.Map<unknown>
export function toYjs(value: object): Y.Map<unknown> | Y.Array<unknown>

export function toYjs(value: any): Y.Map<unknown> | Y.Array<unknown> {
  if (value instanceof Y.Map || value instanceof Y.Array) {
    throw failure("Value is already a Y.js value")
  }

  if (tryUnwrapYjs(value)) {
    throw failure("Value is already a yjs-proxy proxy")
  }

  const converted = convertJsToYjsValue(value)
  if (converted instanceof Y.Map || converted instanceof Y.Array) {
    return converted
  }

  throw failure("Value cannot be converted to a Y.js Map or Array")
}
