import { failure } from "./error/failure"
import { unwrapYjs } from "./unwrapYjs"

/**
 * Converts a `wrapYjs` proxy into a plain JSON-compatible object or array.
 *
 * This calls the `toJSON()` method of the underlying Yjs type.
 *
 * @param proxy The `wrapYjs` proxy to convert.
 * @returns A plain JSON-compatible object or array.
 */
export function yjsWrapperToJson<T>(proxy: T): T {
  const yType = unwrapYjs(proxy)
  if (!yType) {
    throw failure("yjsWrapperToJson only supports wrapYjs proxies")
  }
  return yType.toJSON() as T
}
