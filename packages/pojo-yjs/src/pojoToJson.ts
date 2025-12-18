import { failure } from "./error/failure"
import { getYjsForPojo } from "./getYjsForPojo"

/**
 * Converts a `yjsAsPojo` proxy into a plain JSON-compatible object or array.
 *
 * This calls the `toJSON()` method of the underlying Yjs type.
 *
 * @param proxy The `yjsAsPojo` proxy to convert.
 * @returns A plain JSON-compatible object or array.
 */
export function pojoToJson<T>(proxy: T): T {
  const yType = getYjsForPojo(proxy)
  if (!yType) {
    throw failure("pojoToJson only supports yjsAsPojo proxies")
  }
  return yType.toJSON() as T
}
