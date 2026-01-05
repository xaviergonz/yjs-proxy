import * as Y from "yjs"
import { dataToProxyCache, type ProxyState, setProxyState, tryGetProxyState } from "./cache"
import { convertJsToYjsValue, convertYjsToJsValue } from "./conversion"
import { detachProxyOfYjsValue } from "./detachProxyOfYjsValue"
import { failure } from "./error/failure"
import { getRollbackContext } from "./rollback"
import { applyToAllAliases, linkProxyWithExistingSiblings } from "./sharedRefs"
import type { StringKeyedObject, YjsProxy } from "./types"
import { tryUnwrapJson, tryUnwrapYjs } from "./unwrapYjs"
import { registerRevocableProxy } from "./withYjsProxy"

function setJsonMapValue(json: any, prop: string, value: any): void {
  // We unwrap proxies to their raw data to keep the JSON tree "pure".
  // See the architectural note in cache.ts.
  json[prop] = tryUnwrapJson(value) ?? value
}

function isYMapSetNoOp(ymap: Y.Map<unknown>, prop: string, value: any): boolean {
  if (!ymap.has(prop)) return false
  const currentYjsValue = ymap.get(prop)
  if (currentYjsValue === value) return true
  const newYjsValue = tryUnwrapYjs(value)
  return !!(newYjsValue && newYjsValue === currentYjsValue)
}

function setYMapValue(ymap: Y.Map<unknown>, prop: string, value: any): void {
  if (ymap.has(prop)) {
    // detach old value
    detachProxyOfYjsValue(ymap.get(prop))
  }

  const converted = convertJsToYjsValue(value)
  ymap.set(prop, converted)
}

function isYMapDeleteNoOp(ymap: Y.Map<unknown>, prop: string): boolean {
  return !ymap.has(prop)
}

function deleteYMapValue(ymap: Y.Map<unknown>, prop: string): void {
  detachProxyOfYjsValue(ymap.get(prop))
  ymap.delete(prop)
}

function deleteJsonMapValue(json: any, prop: string): void {
  delete json[prop]
}

/**
 * Creates a proxy for a Y.Map.
 *
 * @param ymap The Y.Map to wrap.
 * @returns A proxy for the Y.Map.
 * @internal
 */
export function ymapProxy(ymap: Y.Map<unknown>): StringKeyedObject {
  return createYMapProxy({ attached: true, yjsValue: ymap })
}

/**
 * Creates a proxy for a Y.Map or a JSON object.
 *
 * @param state The initial state of the proxy.
 * @returns A proxy for the object.
 * @internal
 */
export function createYMapProxy(state: ProxyState<any>): StringKeyedObject {
  const key = state.attached ? state.yjsValue : state.json
  const cached = dataToProxyCache.get(key)
  if (cached) return cached as StringKeyedObject

  const { proxy, revoke } = Proxy.revocable<StringKeyedObject>(Object.create(null), {
    getPrototypeOf() {
      return null
    },
    setPrototypeOf() {
      return false
    },
    preventExtensions() {
      return false
    },
    get(_target, prop) {
      if (prop === Symbol.toStringTag) return "Object"
      if (prop === Symbol.iterator) return undefined
      if (prop === "constructor") return undefined

      const state = tryGetProxyState<any>(proxy)!
      if (!state.attached) {
        const v = state.json[prop as string]
        return dataToProxyCache.get(v) ?? v
      }

      const currentYMap = state.yjsValue as Y.Map<any>
      if (typeof prop === "string" && currentYMap.has(prop)) {
        const v = currentYMap.get(prop)
        return convertYjsToJsValue(v)
      }
      return undefined
    },
    set(_target, prop, value) {
      if (typeof prop !== "string") {
        throw failure(`Objects do not support symbol properties: ${String(prop)}`)
      }
      const state = tryGetProxyState<any>(proxy)!
      // Check for no-op before starting transaction
      if (state.attached && isYMapSetNoOp(state.yjsValue as Y.Map<unknown>, prop, value)) {
        return true
      }

      const rollbackCtx = getRollbackContext()
      if (rollbackCtx?.canRollback) {
        // Read through proxy (works for both attached and detached)
        const hadKey = prop in proxy
        const oldValue = hadKey ? proxy[prop] : undefined

        rollbackCtx.log(() => {
          if (hadKey) {
            proxy[prop] = oldValue // Propagates to aliases automatically
          } else {
            delete proxy[prop]
          }
        })
      }

      applyToAllAliases<Y.Map<unknown>, any>(
        proxy as YjsProxy,
        (ymap) => setYMapValue(ymap, prop, value),
        (json) => setJsonMapValue(json, prop, value)
      )
      return true
    },
    deleteProperty(_target, prop) {
      if (typeof prop !== "string") {
        return true
      }
      const state = tryGetProxyState<any>(proxy)!
      // Check for no-op before starting transaction
      if (state.attached && isYMapDeleteNoOp(state.yjsValue as Y.Map<unknown>, prop)) {
        return true
      }

      const rollbackCtx = getRollbackContext()
      if (rollbackCtx?.canRollback) {
        const hadKey = prop in proxy
        if (hadKey) {
          const oldValue = proxy[prop] // Read through proxy
          rollbackCtx.log(() => {
            proxy[prop] = oldValue
          })
        }
      }

      applyToAllAliases<Y.Map<unknown>, any>(
        proxy as YjsProxy,
        (ymap) => deleteYMapValue(ymap, prop),
        (json) => deleteJsonMapValue(json, prop)
      )
      return true
    },
    has(_target, prop): boolean {
      const state = tryGetProxyState<any>(proxy)!
      if (!state.attached) {
        return prop in state.json
      }
      return typeof prop === "string" && (state.yjsValue as Y.Map<any>).has(prop)
    },
    ownKeys(): Array<string | symbol> {
      const state = tryGetProxyState<any>(proxy)!
      if (!state.attached) {
        return Object.keys(state.json)
      }
      return Array.from((state.yjsValue as Y.Map<any>).keys())
    },
    getOwnPropertyDescriptor(_target, prop): PropertyDescriptor | undefined {
      if (prop in proxy) {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: proxy[prop as string],
        }
      }
      return undefined
    },
    defineProperty(_target, prop, descriptor): boolean {
      if (typeof prop !== "string") {
        return false
      }

      if (
        descriptor.configurable === false ||
        descriptor.enumerable === false ||
        descriptor.writable === false ||
        descriptor.get ||
        descriptor.set
      ) {
        return false
      }

      proxy[prop] = descriptor.value
      return true
    },
  })

  dataToProxyCache.set(key, proxy)
  setProxyState(proxy, state)
  registerRevocableProxy(proxy, revoke)

  // Link proxy aliases with any existing sibling proxies
  if (state.attached) {
    linkProxyWithExistingSiblings(proxy as YjsProxy, state.yjsValue as Y.Map<any>)
  }

  return proxy
}
