import * as Y from "yjs"
import { getProxyState, tryGetProxyState } from "./cache"
import { StringKeyedObject, YjsProxy } from "./types"

/**
 * Retrieves the underlying Y.js value (Map or Array) from a `wrapYjs` proxy.
 *
 * Throws an error if the value is not a `wrapYjs` proxy or if the underlying
 * Y.js value has been deleted.
 *
 * Note: This function returns `undefined` for proxies that are in "detached mode"
 * (e.g., detached from a document or created via `toYjsProxy`).
 *
 * @param value The value to check.
 * @returns The underlying Y.js value or `undefined`.
 */
export function unwrapYjs(value: any[]): Y.Array<unknown> | undefined
export function unwrapYjs(value: StringKeyedObject): Y.Map<unknown> | undefined
export function unwrapYjs(value: unknown): Y.Map<unknown> | Y.Array<unknown> | undefined

export function unwrapYjs(value: any): Y.Map<unknown> | Y.Array<unknown> | undefined {
  const state = getProxyState(value)
  return state.attached ? state.yjsValue : undefined
}

/**
 * Internal function to retrieve the underlying Y.js value from a proxy if it exists.
 * Unlike `unwrapYjs`, this does not throw if the value is not a proxy.
 *
 * @param value The value to check.
 * @returns The underlying Y.js value or `undefined`.
 * @internal
 */
export function tryUnwrapYjs(value: YjsProxy): Y.Map<unknown> | Y.Array<unknown> | undefined {
  const state = tryGetProxyState(value)
  if (state?.attached === true) {
    return state.yjsValue
  }
  return undefined
}

/**
 * Internal function to retrieve the JSON data from a proxy if it exists.
 *
 * This is used to ensure that detached proxy trees only store raw data in their
 * JSON data, not other proxies. See the architectural note in `cache.ts`.
 *
 * @param value The value to check.
 * @returns The JSON data or `undefined`.
 * @internal
 */
export function tryUnwrapJson<T extends object>(value: T): T | undefined {
  const state = tryGetProxyState(value)
  return state && !state.attached ? state.json : undefined
}
