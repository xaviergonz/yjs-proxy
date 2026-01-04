import * as Y from "yjs"
import { failure } from "./error/failure"
import { YjsProxy } from "./types"
import { isObjectLike, isYjsValueDeleted } from "./utils"

/**
 * Represents the internal state of a yjs-proxy proxy.
 *
 * A proxy can be in one of two states:
 * - `attached`: The proxy is "attached" to a Y.js value. All mutations are reflected in the Y.js document.
 * - `detached`: The proxy is "detached" (or not yet attached). It uses a plain JS object/array as its
 *   source of truth.
 *
 * ARCHITECTURAL NOTE:
 * When in `detached` mode, the `json` property MUST be a "pure" tree of plain JavaScript objects
 * and arrays, free of any proxies. This ensures:
 * 1. Clean Snapshots: `yjsWrapperToJson()` can return a deep clone of `json` without proxies.
 * 2. Referential Integrity: `dataToProxyCache` can map these plain objects back to their
 *    respective proxies during `get` operations.
 * 3. Re-attachment: `toYjs()` can easily convert the pure data tree back into Y.js values.
 *
 * Because of this, whenever a value is set on a detached proxy, we attempt to "unwrap" it
 * (see `tryUnwrapJson`) to store the raw data instead of the proxy itself.
 */
export type ProxyState<T> =
  | { attached: true; yjsValue: Y.Map<any> | Y.Array<any>; json?: never }
  | { attached: false; json: T; yjsValue?: never }

const proxyToStateCache = new WeakMap<YjsProxy, ProxyState<any>>()
export const dataToProxyCache = new WeakMap<object, YjsProxy>()
export const markedAsJsValues = new WeakSet<object>()

/**
 * Checks if a value is a `yjs-proxy` proxy.
 *
 * @param value The value to check.
 * @returns `true` if the value is a `yjs-proxy` proxy, `false` otherwise.
 */
export function isYjsProxy(value: unknown): value is YjsProxy {
  return isObjectLike(value) && proxyToStateCache.has(value as YjsProxy)
}

/**
 * Internal function to retrieve the state of a proxy.
 *
 * @param proxy The proxy to unwrap.
 * @returns The state of the proxy.
 * @throws {YjsProxyError} If the value is not a yjs-proxy proxy.
 * @internal
 */
export function getProxyState<T extends object>(proxy: T): ProxyState<T> {
  const state = tryGetProxyState(proxy)
  if (!state) {
    throw failure("Value is not a yjs-proxy proxy")
  }
  return state
}

/**
 * Internal function to retrieve the state of a proxy without throwing if it is not a proxy.
 * It will still throw if the Y.js value is deleted.
 *
 * @param value The value to check.
 * @returns The state of the proxy or `undefined`.
 * @internal
 */
export function tryGetProxyState<T extends object>(value: T): ProxyState<T> | undefined {
  const state = isYjsProxy(value) ? proxyToStateCache.get(value) : undefined
  if (state?.attached === true && isYjsValueDeleted(state.yjsValue)) {
    throw failure("Y.js value is deleted")
  }
  return state
}

/**
 * Internal function to set the state of a proxy.
 *
 * @param proxy The proxy to set the state for.
 * @param state The state to set.
 * @internal
 */
export function setProxyState<T extends object>(proxy: T, state: ProxyState<T>): void {
  proxyToStateCache.set(proxy, state)
}

/**
 * Internal function to remove a proxy from the cache.
 * This is used when revoking proxies in scoped access.
 *
 * @param proxy The proxy to remove.
 * @internal
 */
export function removeProxyFromCache(proxy: object): void {
  const state = proxyToStateCache.get(proxy as YjsProxy)
  if (state) {
    const key = state.attached ? state.yjsValue : state.json
    if (key && dataToProxyCache.get(key) === proxy) {
      dataToProxyCache.delete(key)
    }
    proxyToStateCache.delete(proxy as YjsProxy)
  }
}
