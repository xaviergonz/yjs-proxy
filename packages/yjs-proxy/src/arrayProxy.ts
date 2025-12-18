import * as Y from "yjs"
import { proxyToYjsCache, yjsToProxyCache } from "./cache"
import { convertJsToYjsValue, convertYjsToJsValue } from "./conversion"
import { failure } from "./error/failure"
import { unwrapYjs } from "./unwrapYjs"
import { transactIfPossible } from "./utils"

function snapshotArray(yarr: Y.Array<unknown>, clone: boolean): unknown[] {
  return Array.from(yarr, (v) => convertYjsToJsValue(v, clone))
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

  const unwrapped = unwrapYjs(value)
  if (unwrapped && unwrapped === current) return true

  transactIfPossible(yarr, () => {
    const converted = convertJsToYjsValue(value)

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
            yield convertYjsToJsValue(v, false)
          }
        }
      }
      if (prop === "length") return yarr.length
      const index = parseArrayIndex(prop)
      if (index !== undefined) {
        return convertYjsToJsValue(yarr.get(index), false)
      }

      if (typeof prop === "string") {
        if (prop === "constructor") return Array

        if (isMutatingArrayMethod(prop)) {
          return (...args: any[]) => {
            return transactIfPossible(yarr, () => {
              const len = yarr.length
              const convert = (v: unknown) => convertJsToYjsValue(v)

              switch (prop) {
                case "push": {
                  const converted = args.map(convert)
                  yarr.insert(len, converted)
                  return yarr.length
                }
                case "pop": {
                  if (len === 0) return undefined
                  const val = yarr.get(len - 1)
                  const last = convertYjsToJsValue(val, true)
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
                  const val = yarr.get(0)
                  const first = convertYjsToJsValue(val, true)
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

                  // Convert items BEFORE deleting, in case some items are being moved from the deleted range
                  // these items will be cloned since at this point they are still parented
                  const clonedYjsItems = items.map(convert)

                  const deleted = yarr
                    .slice(actualStart, actualStart + actualDeleteCount)
                    .map((val) => convertYjsToJsValue(val, true))
                  yarr.delete(actualStart, actualDeleteCount)
                  if (clonedYjsItems.length > 0) {
                    yarr.insert(actualStart, clonedYjsItems)
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
                    const count = actualEnd - actualStart
                    const converted = []
                    for (let i = 0; i < count; i++) {
                      // We need to convert for each slot because Yjs types cannot be parented multiple times
                      converted.push(convert(value))
                    }
                    yarr.insert(actualStart, converted)
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
                    // this will clone since the items are still parented
                    const values = yarr.slice(actualStart, actualStart + count).map(convert)
                    yarr.delete(actualTarget, count)
                    yarr.insert(actualTarget, values)
                  }
                  return receiver
                }
                case "reverse":
                case "sort": {
                  // will be cloned later
                  const snap = snapshotArray(yarr, false)
                  Reflect.apply(Reflect.get(Array.prototype, prop), snap, args)
                  // here they are still parented, so cloning happens
                  const converted = snap.map(convert)
                  yarr.delete(0, len)
                  yarr.insert(0, converted)
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
          // a function that does not mutate the array, such as map, filter, slice, etc.
          return (...args: unknown[]) => {
            const snap = snapshotArray(yarr, false)
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
      throw failure(`Arrays do not support custom properties: ${String(prop)}`)
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
          value: convertYjsToJsValue(yarr.get(index), false),
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
