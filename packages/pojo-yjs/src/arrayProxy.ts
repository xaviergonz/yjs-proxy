import * as Y from "yjs"
import { proxyToYjsCache, yjsToProxyCache } from "./cache"
import { convertJsToYjsValue, convertYjsToJsValue } from "./conversion"
import { getYjsForPojo } from "./getYjsForPojo"
import { transactIfPossible } from "./utils"

function snapshotArray(yarr: Y.Array<unknown>): unknown[] {
  return Array.from(yarr, convertYjsToJsValue)
}

function parseArrayIndex(prop: PropertyKey): number | undefined {
  if (typeof prop !== "string") return undefined
  const n = Number(prop)
  if (n >= 0 && Number.isInteger(n) && String(n) === prop) {
    return n
  }
  return undefined
}

function isMutatingArrayMethod(name: string): boolean {
  return (
    name === "copyWithin" ||
    name === "fill" ||
    name === "pop" ||
    name === "push" ||
    name === "reverse" ||
    name === "shift" ||
    name === "sort" ||
    name === "splice" ||
    name === "unshift"
  )
}

function setYArrayLength(yarr: Y.Array<unknown>, value: any): boolean {
  const newLen = Number(value)
  if (!Number.isFinite(newLen) || !Number.isInteger(newLen) || newLen < 0) {
    throw new RangeError("Invalid array length")
  }
  if (newLen === yarr.length) {
    // No change needed
    return true
  }

  transactIfPossible(yarr, () => {
    if (newLen < yarr.length) {
      yarr.delete(newLen, yarr.length - newLen)
    } else if (newLen > yarr.length) {
      const diff = newLen - yarr.length
      // JS fills with undefined, but Yjs cannot store undefined values, so we use null
      yarr.insert(yarr.length, new Array(diff).fill(null))
    }
  })
  return true
}

function setYArrayIndex(yarr: Y.Array<unknown>, index: number, value: any): boolean {
  const current = index < yarr.length ? yarr.get(index) : undefined
  if (current === value && value !== undefined) return true

  const unwrapped = getYjsForPojo(value)
  if (unwrapped && unwrapped === current) return true

  const seen = new WeakSet<object>()
  const converted = convertJsToYjsValue(value, yarr, seen)
  transactIfPossible(yarr, () => {
    if (index < yarr.length) {
      yarr.delete(index, 1)
      yarr.insert(index, [converted])
    } else {
      const diff = index - yarr.length
      if (diff > 0) {
        // JS fills with undefined, but Yjs cannot store undefined values, so we use null
        yarr.insert(yarr.length, new Array(diff).fill(null))
      }
      yarr.insert(index, [converted])
    }
  })
  return true
}

export function yarrayProxy(yarr: Y.Array<unknown>): unknown[] {
  const cached = yjsToProxyCache.get(yarr)
  if (cached) return cached as unknown[]

  const proxy = new Proxy<unknown[]>([], {
    getPrototypeOf() {
      return Array.prototype
    },
    setPrototypeOf() {
      return false
    },
    preventExtensions() {
      return false
    },
    get(_target, prop, receiver) {
      if (prop === Symbol.toStringTag) return "Array"
      if (prop === Symbol.iterator) {
        return function* iterator() {
          for (const v of yarr) {
            yield convertYjsToJsValue(v)
          }
        }
      }
      if (prop === "length") return yarr.length
      const index = parseArrayIndex(prop)
      if (index !== undefined) {
        return convertYjsToJsValue(yarr.get(index))
      }

      if (typeof prop === "string") {
        if (prop === "constructor") return Array

        if (isMutatingArrayMethod(prop)) {
          return (...args: any[]) => {
            return transactIfPossible(yarr, () => {
              const len = yarr.length
              const seen = new WeakSet<object>()
              const convert = (v: any) => convertJsToYjsValue(v, yarr, seen)

              switch (prop) {
                case "push": {
                  const converted = args.map(convert)
                  yarr.insert(len, converted)
                  return yarr.length
                }
                case "pop": {
                  if (len === 0) return undefined
                  const last = convertYjsToJsValue(yarr.get(len - 1))
                  yarr.delete(len - 1, 1)
                  return last
                }
                case "unshift": {
                  const converted = args.map(convert)
                  yarr.insert(0, converted)
                  return yarr.length
                }
                case "shift": {
                  if (len === 0) return undefined
                  const first = convertYjsToJsValue(yarr.get(0))
                  yarr.delete(0, 1)
                  return first
                }
                case "splice": {
                  const start = args[0]
                  const deleteCount = args[1]
                  const items = args.slice(2)
                  const actualStart = start < 0 ? Math.max(len + start, 0) : Math.min(start, len)
                  const actualDeleteCount =
                    deleteCount === undefined
                      ? len - actualStart
                      : Math.min(Math.max(deleteCount, 0), len - actualStart)

                  const deleted = yarr
                    .slice(actualStart, actualStart + actualDeleteCount)
                    .map(convertYjsToJsValue)
                  yarr.delete(actualStart, actualDeleteCount)
                  if (items.length > 0) {
                    yarr.insert(actualStart, items.map(convert))
                  }
                  return deleted
                }
                case "fill": {
                  const value = args[0]
                  const start = args[1] ?? 0
                  const end = args[2] ?? len
                  const actualStart = start < 0 ? Math.max(len + start, 0) : Math.min(start, len)
                  const actualEnd = end < 0 ? Math.max(len + end, 0) : Math.min(end, len)

                  if (actualEnd > actualStart) {
                    yarr.delete(actualStart, actualEnd - actualStart)
                    yarr.insert(
                      actualStart,
                      new Array(actualEnd - actualStart).fill(convert(value))
                    )
                  }
                  return receiver
                }
                case "copyWithin": {
                  const target = args[0]
                  const start = args[1] ?? 0
                  const end = args[2] ?? len
                  const actualTarget =
                    target < 0 ? Math.max(len + target, 0) : Math.min(target, len)
                  const actualStart = start < 0 ? Math.max(len + start, 0) : Math.min(start, len)
                  const actualEnd = end < 0 ? Math.max(len + end, 0) : Math.min(end, len)
                  const count = Math.min(actualEnd - actualStart, len - actualTarget)

                  if (count > 0) {
                    const values = yarr
                      .slice(actualStart, actualStart + count)
                      .map((v) => (v instanceof Y.AbstractType ? v.clone() : v))
                    yarr.delete(actualTarget, count)
                    yarr.insert(actualTarget, values)
                  }
                  return receiver
                }
                case "reverse":
                case "sort": {
                  const snap = snapshotArray(yarr)
                  Reflect.apply(Reflect.get(Array.prototype, prop), snap, args)
                  yarr.delete(0, len)
                  yarr.insert(0, snap.map(convert))
                  return receiver
                }
                default:
                  return undefined
              }
            })
          }
        }

        const native = Reflect.get(Array.prototype, prop)
        if (typeof native === "function") {
          return (...args: unknown[]) => {
            const snap = snapshotArray(yarr)
            return Reflect.apply(native, snap, args)
          }
        }
      }

      return undefined
    },
    set(_target, prop, value) {
      if (prop === "length") {
        return setYArrayLength(yarr, value)
      }

      const index = parseArrayIndex(prop)
      if (index !== undefined) {
        return setYArrayIndex(yarr, index, value)
      }
      return false
    },
    deleteProperty(_target, prop) {
      const index = parseArrayIndex(prop)
      if (index === undefined) {
        return true
      }
      if (index >= yarr.length) return true
      if (yarr.get(index) === null) {
        // No change needed
        return true
      }

      transactIfPossible(yarr, () => {
        yarr.delete(index, 1)
        // JS fills with undefined, but Yjs cannot store undefined values, so we use null
        yarr.insert(index, [null])
      })
      return true
    },
    has(_target, prop) {
      if (prop === "length") return true
      const index = parseArrayIndex(prop)
      if (index !== undefined) return index < yarr.length
      return Reflect.has(_target, prop)
    },
    ownKeys() {
      const keys: string[] = []
      for (let i = 0; i < yarr.length; i++) keys.push(String(i))
      keys.push("length")
      return keys
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (prop === "length") {
        return {
          configurable: false,
          enumerable: false,
          writable: true,
          value: yarr.length,
        }
      }
      const index = parseArrayIndex(prop)
      if (index !== undefined) {
        if (index >= yarr.length) return undefined
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: convertYjsToJsValue(yarr.get(index)),
        }
      }
      return undefined
    },
    defineProperty(_target, prop, descriptor) {
      if (prop === "length") {
        if (descriptor.value !== undefined) {
          return setYArrayLength(yarr, descriptor.value)
        }
        return false
      }
      const index = parseArrayIndex(prop)
      if (index !== undefined) {
        if (descriptor.value !== undefined) {
          return setYArrayIndex(yarr, index, descriptor.value)
        }
        return false
      }
      return false
    },
  })

  yjsToProxyCache.set(yarr, proxy)
  proxyToYjsCache.set(proxy, yarr)
  return proxy
}
