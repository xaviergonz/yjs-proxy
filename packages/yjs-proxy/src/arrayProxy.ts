import * as Y from "yjs"
import { dataToProxyCache, type ProxyState, setProxyState, tryGetProxyState } from "./cache"
import { convertJsToYjsValue, convertYjsToJsValue } from "./conversion"
import { detachProxyOfYjsValue } from "./detachProxyOfYjsValue"
import { failure } from "./error/failure"
import { getRollbackContext } from "./rollback"
import { applyToAllAliases, linkProxyWithExistingSiblings } from "./sharedRefs"
import type { YjsProxy } from "./types"
import { tryUnwrapJson, tryUnwrapYjs } from "./unwrapYjs"
import { registerRevocableProxy } from "./withYjsProxy"

/**
 * Normalizes an array index, handling negative values like JS array methods.
 * Negative indices count from the end; result is clamped to [0, len].
 */
function normalizeIndex(index: number, len: number): number {
  return index < 0 ? Math.max(len + index, 0) : Math.min(index, len)
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

function isYArrayLengthNoOp(yarr: Y.Array<unknown>, value: any): boolean {
  const newLen = Number(value)
  if (!Number.isFinite(newLen) || !Number.isInteger(newLen) || newLen < 0) {
    return false // will throw, not a no-op
  }
  return newLen === yarr.length
}

function setYArrayLength(yarr: Y.Array<unknown>, value: any): void {
  const newLen = Number(value)
  if (!Number.isFinite(newLen) || !Number.isInteger(newLen) || newLen < 0) {
    throw new RangeError("Invalid array length")
  }

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
}

function setJsonArrayLength(json: any[], newLen: number): void {
  if (newLen === json.length) return
  json.length = newLen
}

function setJsonArrayIndex(json: any[], index: number, value: any): void {
  // We unwrap proxies to their raw data to keep the JSON tree "pure".
  // See the architectural note in cache.ts.
  json[index] = tryUnwrapJson(value) ?? value
}

function isYArrayIndexNoOp(yarr: Y.Array<unknown>, index: number, value: any): boolean {
  if (index >= yarr.length) return false // will expand array
  const currentYjsValue = yarr.get(index)
  if (currentYjsValue === value && value !== undefined) return true
  const newYjsValue = tryUnwrapYjs(value)
  return !!(newYjsValue && newYjsValue === currentYjsValue)
}

function setYArrayIndex(yarr: Y.Array<unknown>, index: number, value: any): void {
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

  const { proxy, revoke } = Proxy.revocable<any[]>([], {
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
            const convert = (v: unknown) => convertJsToYjsValue(v)

            /** Helper to apply to all aliases using the shared function */
            const applyToAliases = (
              yjsFn: (arr: Y.Array<unknown>) => void,
              jsonFn: (json: any[]) => void
            ) => {
              applyToAllAliases<Y.Array<unknown>, any[]>(proxy as YjsProxy, yjsFn, jsonFn)
            }

            switch (prop) {
              case "push": {
                // Log inverse operation BEFORE mutation
                const rollbackCtx = getRollbackContext()
                const oldLength = proxy.length

                if (rollbackCtx?.canRollback) {
                  rollbackCtx.log(() => {
                    proxy.length = oldLength
                  })
                }

                applyToAliases(
                  (arr) => {
                    arr.insert(arr.length, args.map(convert))
                  },
                  (json) => {
                    json.push(...args.map((v) => tryUnwrapJson(v) ?? v))
                  }
                )

                return currentYArr.length
              }

              case "pop": {
                if (currentYArr.length === 0) return undefined
                const lastJsValue = proxy[proxy.length - 1]

                const rollbackCtx = getRollbackContext()
                if (rollbackCtx?.canRollback) {
                  rollbackCtx.log(() => {
                    proxy.push(lastJsValue)
                  })
                }

                applyToAliases(
                  (arr) => {
                    if (arr.length > 0) {
                      detachProxyOfYjsValue(arr.get(arr.length - 1))
                      arr.delete(arr.length - 1, 1)
                    }
                  },
                  (json) => {
                    json.pop()
                  }
                )
                return lastJsValue
              }

              case "unshift": {
                const rollbackCtx = getRollbackContext()
                const insertCount = args.length

                if (rollbackCtx?.canRollback && insertCount > 0) {
                  rollbackCtx.log(() => {
                    proxy.splice(0, insertCount)
                  })
                }

                applyToAliases(
                  (arr) => {
                    arr.insert(0, args.map(convert))
                  },
                  (json) => {
                    json.unshift(...args.map((v) => tryUnwrapJson(v) ?? v))
                  }
                )

                return currentYArr.length
              }

              case "shift": {
                if (currentYArr.length === 0) return undefined
                const firstJsValue = proxy[0]

                const rollbackCtx = getRollbackContext()
                if (rollbackCtx?.canRollback) {
                  rollbackCtx.log(() => {
                    proxy.unshift(firstJsValue)
                  })
                }

                applyToAliases(
                  (arr) => {
                    if (arr.length > 0) {
                      detachProxyOfYjsValue(arr.get(0))
                      arr.delete(0, 1)
                    }
                  },
                  (json) => {
                    json.shift()
                  }
                )
                return firstJsValue
              }

              case "splice": {
                const start = args[0]
                const deleteCount = args[1]
                const items = args.slice(2)

                // Calculate for primary array to determine return value
                const len = proxy.length
                const actualStart = normalizeIndex(start, len)
                const actualDeleteCount =
                  deleteCount === undefined
                    ? len - actualStart
                    : Math.min(Math.max(deleteCount, 0), len - actualStart)

                const deletedJsValues = proxy.slice(actualStart, actualStart + actualDeleteCount)
                const insertCount = items.length

                const rollbackCtx = getRollbackContext()
                if (rollbackCtx?.canRollback) {
                  rollbackCtx.log(() => {
                    // Remove what was inserted, re-insert what was deleted
                    proxy.splice(actualStart, insertCount, ...deletedJsValues)
                  })
                }

                applyToAliases(
                  (arr) => {
                    const arrLen = arr.length
                    const arrStart = normalizeIndex(start, arrLen)
                    const arrDeleteCount =
                      deleteCount === undefined
                        ? arrLen - arrStart
                        : Math.min(Math.max(deleteCount, 0), arrLen - arrStart)

                    // Convert items BEFORE deleting, in case some items are being moved from the deleted range
                    const clonedItems = items.map(convert)

                    for (const v of arr.slice(arrStart, arrStart + arrDeleteCount)) {
                      detachProxyOfYjsValue(v)
                    }
                    arr.delete(arrStart, arrDeleteCount)
                    if (clonedItems.length > 0) {
                      arr.insert(arrStart, clonedItems)
                    }
                  },
                  (json) => {
                    const jsonItems = items.map((v) => tryUnwrapJson(v) ?? v)
                    json.splice(start, deleteCount, ...jsonItems)
                  }
                )
                return deletedJsValues
              }

              case "fill": {
                const fillValue = args[0]
                const start = args[1] ?? 0
                const end = args[2]

                const len = currentYArr.length
                const actualStart = normalizeIndex(start, len)
                const actualEnd = normalizeIndex(end ?? len, len)
                const count = actualEnd - actualStart

                if (count > 0) {
                  const fillValues = new Array(count).fill(fillValue)
                  proxy.splice(actualStart, count, ...fillValues)
                }
                return receiver
              }

              case "copyWithin": {
                const target = args[0]
                const start = args[1] ?? 0
                const end = args[2]

                const len = currentYArr.length
                const actualTarget = normalizeIndex(target, len)
                const actualStart = normalizeIndex(start, len)
                const actualEnd = normalizeIndex(end ?? len, len)
                const count = Math.min(actualEnd - actualStart, len - actualTarget)

                if (count > 0) {
                  // Get values BEFORE modifying (slice returns proxies, splice will clone them)
                  const valuesToCopy = proxy.slice(actualStart, actualStart + count)
                  proxy.splice(actualTarget, count, ...valuesToCopy)
                }
                return receiver
              }

              case "reverse": {
                const reversed = [...proxy].reverse()
                proxy.splice(0, currentYArr.length, ...reversed)
                return receiver
              }

              case "sort": {
                const sorted = [...proxy].sort(args[0])
                proxy.splice(0, currentYArr.length, ...sorted)
                return receiver
              }

              /* v8 ignore next 2 */
              default:
                return undefined
            }
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
        // Check for no-op before starting transaction
        if (state.attached && isYArrayLengthNoOp(state.yjsValue as Y.Array<unknown>, value)) {
          return true
        }

        const rollbackCtx = getRollbackContext()
        if (rollbackCtx?.canRollback) {
          const oldLength = proxy.length
          const newLen = Number(value)

          if (newLen < oldLength) {
            // Truncating - save items being removed
            const removedItems = proxy.slice(newLen)
            rollbackCtx.log(() => {
              proxy.push(...removedItems)
            })
          } else if (newLen > oldLength) {
            // Extending - rollback by truncating
            rollbackCtx.log(() => {
              proxy.length = oldLength
            })
          }
        }

        applyToAllAliases<Y.Array<unknown>, any[]>(
          proxy as YjsProxy,
          (arr) => setYArrayLength(arr, value),
          (json) => setJsonArrayLength(json, value)
        )
        return true
      }

      const index = parseArrayIndex(prop)
      if (index !== undefined) {
        // Check for no-op before starting transaction
        if (state.attached && isYArrayIndexNoOp(state.yjsValue as Y.Array<unknown>, index, value)) {
          return true
        }

        const rollbackCtx = getRollbackContext()
        if (rollbackCtx?.canRollback) {
          const currentLength = proxy.length
          if (index < currentLength) {
            const oldValue = proxy[index]
            rollbackCtx.log(() => {
              proxy[index] = oldValue
            })
          } else {
            // Extending array - rollback by truncating
            rollbackCtx.log(() => {
              proxy.length = currentLength
            })
          }
        }

        applyToAllAliases<Y.Array<unknown>, any[]>(
          proxy as YjsProxy,
          (arr) => setYArrayIndex(arr, index, value),
          (json) => setJsonArrayIndex(json, index, value)
        )
        return true
      }

      throw failure(`Arrays do not support custom properties: ${String(prop)}`)
    },
    deleteProperty(_target, prop) {
      const index = parseArrayIndex(prop)
      if (index === undefined) {
        return true
      }

      const state = tryGetProxyState<any[]>(proxy)!
      // Check for no-op before starting transaction
      if (state.attached) {
        const arr = state.yjsValue as Y.Array<unknown>
        if (index >= arr.length || arr.get(index) === null) {
          return true
        }
      }

      const rollbackCtx = getRollbackContext()
      if (rollbackCtx?.canRollback) {
        if (index < proxy.length && proxy[index] !== null) {
          const oldValue = proxy[index]
          rollbackCtx.log(() => {
            proxy[index] = oldValue
          })
        }
      }

      const deleteAtIndex = (arr: Y.Array<unknown>) => {
        if (index >= arr.length) return
        detachProxyOfYjsValue(arr.get(index))
        arr.delete(index, 1)
        arr.insert(index, [null])
      }

      const deleteAtIndexJson = (json: any[]) => {
        if (index < json.length && json[index] !== null) {
          json[index] = null
        }
      }

      applyToAllAliases<Y.Array<unknown>, any[]>(
        proxy as YjsProxy,
        deleteAtIndex,
        deleteAtIndexJson
      )
      return true
    },
    has(target, prop): boolean {
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
    getOwnPropertyDescriptor(_target, prop): PropertyDescriptor | undefined {
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
  registerRevocableProxy(proxy, revoke)

  // Link proxy aliases with any existing sibling proxies
  if (state.attached) {
    linkProxyWithExistingSiblings(proxy as YjsProxy, state.yjsValue as Y.Array<any>)
  }

  return proxy
}
