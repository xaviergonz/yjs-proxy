import * as Y from "yjs"
import { dataToProxyCache, ProxyState, setProxyState, tryGetProxyState } from "./cache"
import { convertJsToYjsValue, convertYjsToJsValue } from "./conversion"
import { detachProxyOfYjsValue } from "./detachProxyOfYjsValue"
import { failure } from "./error/failure"
import { StringKeyedObject } from "./types"
import { tryUnwrapJson, tryUnwrapYjs } from "./unwrapYjs"
import { transactIfPossible } from "./utils"

function setJsonMapValue(json: any, prop: string, value: any): boolean {
  // We unwrap proxies to their raw data to keep the JSON tree "pure".
  // See the architectural note in cache.ts.
  json[prop] = tryUnwrapJson(value) ?? value
  return true
}

function setYMapValue(ymap: Y.Map<unknown>, prop: string, value: any): boolean {
  // detach old value if it exists
  if (ymap.has(prop)) {
    const currentYjsValue = ymap.get(prop)
    if (currentYjsValue === value) return true

    const newYjsValue = tryUnwrapYjs(value)
    if (newYjsValue && newYjsValue === currentYjsValue) return true

    detachProxyOfYjsValue(currentYjsValue)
  }

  transactIfPossible(ymap, () => {
    const converted = convertJsToYjsValue(value)
    ymap.set(prop, converted)
  })
  return true
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

  const proxy: StringKeyedObject = new Proxy<StringKeyedObject>(Object.create(null), {
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
      if (!state.attached) {
        return setJsonMapValue(state.json, prop, value)
      }
      return setYMapValue(state.yjsValue as Y.Map<any>, prop, value)
    },
    deleteProperty(_target, prop) {
      if (typeof prop !== "string") {
        return true
      }

      const state = tryGetProxyState<any>(proxy)!
      if (!state.attached) {
        delete state.json[prop]
        return true
      }

      const currentYMap = state.yjsValue as Y.Map<any>
      if (!currentYMap.has(prop)) {
        return true
      }

      detachProxyOfYjsValue(currentYMap.get(prop))
      transactIfPossible(currentYMap, () => {
        currentYMap.delete(prop)
      })
      return true
    },
    has(_target, prop) {
      const state = tryGetProxyState<any>(proxy)!
      if (!state.attached) {
        return prop in state.json
      }
      return typeof prop === "string" && (state.yjsValue as Y.Map<any>).has(prop)
    },
    ownKeys() {
      const state = tryGetProxyState<any>(proxy)!
      if (!state.attached) {
        return Object.keys(state.json)
      }
      return Array.from((state.yjsValue as Y.Map<any>).keys())
    },
    getOwnPropertyDescriptor(_target, prop) {
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
  return proxy
}
