import * as Y from "yjs"
import { dataToProxyCache, ProxyState, setProxyState, tryGetProxyState } from "./cache"
import { convertJsToYjsValue, convertYjsToJsValue } from "./conversion"
import { detachProxyOfYjsValue } from "./detachProxyOfYjsValue"
import { failure } from "./error/failure"
import { tryUnwrapJson, tryUnwrapYjs, unwrapYjs } from "./unwrapYjs"
import { isObjectLike, transactIfPossible } from "./utils"

function snapshotArray(yarr: Y.Array<unknown>): unknown[] {
  return Array.from(yarr, (v) => convertYjsToJsValue(v))
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
      // detach removed items
      for (let i = newLen; i < yarr.length; i++) {
        detachProxyOfYjsValue(yarr.get(i))
      }
      yarr.delete(newLen, yarr.length - newLen)
    } else if (newLen > yarr.length) {
      const diff = newLen - yarr.length
      // JS fills with undefined, but Yjs cannot store undefined values, so we use null
      yarr.insert(yarr.length, new Array(diff).fill(null))
    }
  })
  return true
}

function setJsonArrayIndex(json: any[], index: number, value: any): boolean {
  // We unwrap proxies to their raw data to keep the JSON tree "pure".
  // See the architectural note in cache.ts.
  json[index] = tryUnwrapJson(value) ?? value
  return true
}

function setYArrayIndex(yarr: Y.Array<unknown>, index: number, value: any): boolean {
  const currentYjsValue = index < yarr.length ? yarr.get(index) : undefined
  if (currentYjsValue === value && value !== undefined) return true

  const newYjsValue = tryUnwrapYjs(value)
  if (newYjsValue && newYjsValue === currentYjsValue) return true

  transactIfPossible(yarr, () => {
    const converted = convertJsToYjsValue(value)

    if (index < yarr.length) {
      detachProxyOfYjsValue(yarr.get(index))
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

/**
 * Creates a proxy for a Y.Array.
 *
 * @param yarr The Y.Array to wrap.
 * @returns A proxy for the Y.Array.
 * @internal
 */
export function yarrayProxy(yarr: Y.Array<unknown>): unknown[] {
  return createYArrayProxy({ attached: true, yjsValue: yarr })
}

/**
 * Creates a proxy for a Y.Array or a JSON array.
 *
 * @param state The initial state of the proxy.
 * @returns A proxy for the array.
 * @internal
 */
export function createYArrayProxy(state: ProxyState<any>): any[] {
  const key = state.attached ? state.yjsValue : state.json
  const cached = dataToProxyCache.get(key)
  if (cached) return cached as any[]

  const proxy: any[] = new Proxy<any[]>([], {
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
      if (prop === "constructor") return Array

      const state = tryGetProxyState<any[]>(proxy)!
      if (!state.attached) {
        // detached mode
        const json = state.json
        if (prop === Symbol.iterator) {
          return function* iterator() {
            for (const v of json) {
              yield dataToProxyCache.get(v) ?? v
            }
          }
        }
        if (prop === "length") return json.length
        const index = parseArrayIndex(prop)
        if (index !== undefined) {
          const v = json[index]
          return dataToProxyCache.get(v) ?? v
        }

        const native = (Array.prototype as any)[prop]
        if (typeof native === "function") {
          return (...args: unknown[]) => Reflect.apply(native, proxy, args)
        }
        return undefined
      }

      // attached mode
      const currentYArr = state.yjsValue as Y.Array<any>
      if (prop === Symbol.iterator) {
        return function* iterator() {
          for (const v of currentYArr) {
            yield convertYjsToJsValue(v)
          }
        }
      }

      if (prop === "length") return currentYArr.length

      const index = parseArrayIndex(prop)
      if (index !== undefined) {
        return convertYjsToJsValue(currentYArr.get(index))
      }

      if (typeof prop === "string") {
        if (isMutatingArrayMethod(prop)) {
          return (...args: any[]) => {
            return transactIfPossible(currentYArr, () => {
              const len = currentYArr.length
              const convert = (v: unknown) => convertJsToYjsValue(v)

              switch (prop) {
                case "push": {
                  const yjsValuesToPush = args.map(convert)
                  currentYArr.insert(len, yjsValuesToPush)
                  return currentYArr.length
                }

                case "pop": {
                  if (len === 0) return undefined
                  const lastYjsValue = currentYArr.get(len - 1)
                  detachProxyOfYjsValue(lastYjsValue)
                  const lastJsValue = convertYjsToJsValue(lastYjsValue)
                  currentYArr.delete(len - 1, 1)
                  return lastJsValue
                }

                case "unshift": {
                  const yjsValuesToUnshift = args.map(convert)
                  currentYArr.insert(0, yjsValuesToUnshift)
                  return currentYArr.length
                }

                case "shift": {
                  if (len === 0) return undefined
                  const firstYjsValue = currentYArr.get(0)
                  detachProxyOfYjsValue(firstYjsValue)
                  const firstJsValue = convertYjsToJsValue(firstYjsValue)
                  currentYArr.delete(0, 1)
                  return firstJsValue
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

                  const deletedYjsValues = currentYArr.slice(
                    actualStart,
                    actualStart + actualDeleteCount
                  )
                  for (const yjsValue of deletedYjsValues) {
                    detachProxyOfYjsValue(yjsValue)
                  }

                  const deletedJsValues = deletedYjsValues.map((val) => convertYjsToJsValue(val))
                  currentYArr.delete(actualStart, actualDeleteCount)
                  if (clonedYjsItems.length > 0) {
                    currentYArr.insert(actualStart, clonedYjsItems)
                  }
                  return deletedJsValues
                }

                case "fill": {
                  const fillValue = args[0]
                  const start = args[1] ?? 0
                  const end = args[2] ?? len
                  const actualStart = start < 0 ? Math.max(len + start, 0) : Math.min(start, len)
                  const actualEnd = end < 0 ? Math.max(len + end, 0) : Math.min(end, len)

                  if (actualEnd > actualStart) {
                    for (let i = actualStart; i < actualEnd; i++) {
                      detachProxyOfYjsValue(currentYArr.get(i))
                    }
                    currentYArr.delete(actualStart, actualEnd - actualStart)
                    const count = actualEnd - actualStart
                    const yjsValuesToAdd = []
                    for (let i = 0; i < count; i++) {
                      // We need to convert for each slot because Y.js values cannot be parented multiple times
                      yjsValuesToAdd.push(convert(fillValue))
                    }
                    currentYArr.insert(actualStart, yjsValuesToAdd)
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
                    for (let i = actualTarget; i < actualTarget + count; i++) {
                      detachProxyOfYjsValue(currentYArr.get(i))
                    }
                    // this will clone since the items are still parented
                    const yjsValues = currentYArr
                      .slice(actualStart, actualStart + count)
                      .map((v) => (v instanceof Y.AbstractType ? v.clone() : v))
                    currentYArr.delete(actualTarget, count)
                    currentYArr.insert(actualTarget, yjsValues)
                  }
                  return receiver
                }

                case "reverse":
                case "sort": {
                  // snap is a collection of proxy-wrapped objects + primitive values
                  const snap = snapshotArray(currentYArr)
                  Reflect.apply(Array.prototype[prop], snap, args)
                  const converted = snap.map((v) => (isObjectLike(v) ? unwrapYjs(v)!.clone() : v))
                  for (let i = 0; i < currentYArr.length; i++) {
                    detachProxyOfYjsValue(currentYArr.get(i))
                  }
                  currentYArr.delete(0, len)
                  currentYArr.insert(0, converted)
                  return receiver
                }

                /* v8 ignore next 2 */
                default:
                  return undefined
              }
            })
          }
        }

        const native = (Array.prototype as any)[prop]
        if (typeof native === "function") {
          // a function that does not mutate the array, such as map, filter, slice, etc.
          return (...args: unknown[]) => Reflect.apply(native, proxy, args)
        }
      }

      return undefined
    },
    set(_target, prop, value) {
      const state = tryGetProxyState<any[]>(proxy)!
      if (prop === "length") {
        if (!state.attached) {
          state.json.length = value
          return true
        }
        return setYArrayLength(state.yjsValue as Y.Array<any>, value)
      }

      const index = parseArrayIndex(prop)
      if (index !== undefined) {
        if (!state.attached) {
          return setJsonArrayIndex(state.json, index, value)
        }
        return setYArrayIndex(state.yjsValue as Y.Array<any>, index, value)
      }

      throw failure(`Arrays do not support custom properties: ${String(prop)}`)
    },
    deleteProperty(_target, prop) {
      const state = tryGetProxyState<any[]>(proxy)!
      const index = parseArrayIndex(prop)
      if (index === undefined) {
        return true
      }

      if (!state.attached) {
        // detached mode
        if (index < state.json.length) {
          state.json[index] = null
        }
        return true
      }

      // attached mode
      const currentYArr = state.yjsValue as Y.Array<any>
      if (index >= currentYArr.length) return true
      if (currentYArr.get(index) === null) {
        // No change needed
        return true
      }

      detachProxyOfYjsValue(currentYArr.get(index))
      transactIfPossible(currentYArr, () => {
        currentYArr.delete(index, 1)
        // JS fills with undefined, but Yjs cannot store undefined values, so we use null
        currentYArr.insert(index, [null])
      })
      return true
    },
    has(target, prop) {
      if (prop === "length") return true

      const index = parseArrayIndex(prop)

      const state = tryGetProxyState<any[]>(proxy)!
      if (index !== undefined) {
        const len = !state.attached ? state.json.length : (state.yjsValue as Y.Array<any>).length
        return index < len
      }

      return Reflect.has(target, prop)
    },
    ownKeys() {
      const keys: string[] = ["length"]
      for (let i = 0; i < proxy.length; i++) keys.push(String(i))
      return keys
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (prop === "length") {
        return {
          configurable: false,
          enumerable: false,
          writable: true,
          value: proxy.length,
        }
      }

      const index = parseArrayIndex(prop)

      if (index !== undefined) {
        if (index >= proxy.length) return undefined
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: proxy[index],
        }
      }
      return undefined
    },
    defineProperty(_target, prop, descriptor): boolean {
      if (descriptor.get || descriptor.set) {
        return false
      }

      if (prop === "length") {
        if (
          descriptor.configurable === true ||
          descriptor.enumerable === true ||
          descriptor.writable === false
        ) {
          return false
        }
        proxy.length = descriptor.value
        return true
      }

      const index = parseArrayIndex(prop)
      if (index !== undefined) {
        if (
          descriptor.configurable === false ||
          descriptor.enumerable === false ||
          descriptor.writable === false
        ) {
          return false
        }
        proxy[index] = descriptor.value
        return true
      }
      return false
    },
  })

  dataToProxyCache.set(key, proxy)
  setProxyState(proxy, state)
  return proxy
}
