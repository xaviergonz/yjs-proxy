import rfdc from "rfdc"
import { getProxyState } from "./cache"

const clone = rfdc()

/**
 * Converts a `wrapYjs` proxy into a plain JSON-compatible object or array.
 *
 * This calls the `toJSON()` method of the underlying Y.js value.
 *
 * @param proxy The `wrapYjs` proxy to convert.
 * @returns A plain JSON-compatible object or array.
 */
export function yjsWrapperToJson<T extends object>(proxy: T): T {
  const state = getProxyState(proxy)
  return !state.attached ? (clone(state.json) as T) : (state.yjsValue.toJSON() as T)
}
