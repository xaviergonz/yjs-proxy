import * as Y from "yjs"
import { proxyToYjsCache, yjsToProxyCache } from "./cache"
import { convertJsToYjsValue, convertYjsToJsValue } from "./conversion"
import { StringKeyedObject } from "./types"
import { unwrapYjs } from "./unwrapYjs"
import { transactIfPossible } from "./utils"

function setYMapValue(ymap: Y.Map<unknown>, prop: string, value: any): boolean {
  if (ymap.has(prop)) {
    const current = ymap.get(prop)
    if (current === value) return true

    const unwrapped = unwrapYjs(value)
    if (unwrapped && unwrapped === current) return true
  }

  const seen = new WeakSet<object>()
  const converted = convertJsToYjsValue(value, ymap, seen)
  transactIfPossible(ymap, () => {
    ymap.set(prop, converted)
  })
  return true
}

export function ymapProxy(ymap: Y.Map<unknown>): StringKeyedObject {
  const cached = yjsToProxyCache.get(ymap)
  if (cached) return cached as StringKeyedObject

  const proxy = new Proxy<StringKeyedObject>(Object.create(null), {
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
      if (typeof prop === "string" && ymap.has(prop)) {
        const v = ymap.get(prop)
        return convertYjsToJsValue(v)
      }
      return undefined
    },
    set(_target, prop, value) {
      if (typeof prop !== "string") {
        return false
      }
      return setYMapValue(ymap, prop, value)
    },
    deleteProperty(_target, prop) {
      if (typeof prop !== "string") {
        return true
      }
      if (!ymap.has(prop)) {
        return true
      }

      transactIfPossible(ymap, () => {
        ymap.delete(prop)
      })
      return true
    },
    has(_target, prop) {
      return typeof prop === "string" && ymap.has(prop)
    },
    ownKeys() {
      return Array.from(ymap.keys())
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === "string" && ymap.has(prop)) {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: convertYjsToJsValue(ymap.get(prop)),
        }
      }
      return undefined
    },
    defineProperty(_target, prop, descriptor) {
      if (typeof prop !== "string") {
        return false
      }
      if (descriptor.value !== undefined) {
        return setYMapValue(ymap, prop, descriptor.value)
      }
      return false // We only support value-based definitions
    },
  })

  yjsToProxyCache.set(ymap, proxy)
  proxyToYjsCache.set(proxy, ymap)
  return proxy
}
