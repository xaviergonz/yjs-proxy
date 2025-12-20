import * as Y from "yjs"
import { dataToProxyCache, markedAsJsValues, setProxyState, tryGetProxyState } from "./cache"
import { failure } from "./error/failure"
import { isMarkedAsJs } from "./markAsJs"
import { tryUnwrapYjs } from "./unwrapYjs"
import { deepFreeze, isObjectLike, isPlainObject, isYjsValueDeleted } from "./utils"
import { wrapYjs } from "./wrapYjs"

/**
 * Converts a JS value to a Y.js value.
 *
 * @param value The JS value to convert.
 * @param seen A WeakSet of objects already seen to handle circular references.
 * @returns The converted Y.js value.
 */
export function convertJsToYjsValue(value: any, seen: WeakSet<object> = new WeakSet()): unknown {
  if (!isObjectLike(value)) return value

  // If it's a proxy in detached mode, or a JSON object that has a proxy, re-attach it
  const state = tryGetProxyState(value)
  const proxy = state && !state.attached ? value : dataToProxyCache.get(value)
  const proxyState = proxy ? tryGetProxyState(proxy) : undefined
  const json = proxyState && !proxyState.attached ? proxyState.json : undefined

  if (proxy && json !== undefined) {
    // This is a proxy that was detached and is now being re-attached,
    // or its JSON data being converted.
    // We create a new Y.js value from the JSON data.
    const newYjsValue = Array.isArray(json) ? new Y.Array() : new Y.Map()

    // Update the caches so the proxy now points to the new Y.js value
    setProxyState(proxy, { attached: true, yjsValue: newYjsValue })
    dataToProxyCache.set(newYjsValue, proxy)
    dataToProxyCache.delete(json)

    // Populate the new Y.js value from the JSON data
    if (newYjsValue instanceof Y.Map) {
      for (const k of Object.keys(json)) {
        const v = (json as any)[k]
        newYjsValue.set(k, convertJsToYjsValue(v, seen))
      }
    } else {
      const converted = (json as any[]).map((item) => convertJsToYjsValue(item, seen))
      newYjsValue.insert(0, converted)
    }

    return newYjsValue
  }

  const unwrapped = tryUnwrapYjs(value)
  const yjsValue = unwrapped ?? (value instanceof Y.AbstractType ? value : undefined)

  if (yjsValue) {
    if (isYjsValueDeleted(yjsValue)) {
      throw failure("Cannot wrap a deleted Y.js value")
    }
    // We clone if already integrated (has a parent or doc)
    if (yjsValue.parent !== null || yjsValue.doc !== null) {
      return yjsValue.clone()
    }
    // If it's unparented and we've seen it before, we MUST clone it to avoid
    // Yjs "already parented" errors, but we can't clone unparented types.
    // This does not happen in our unit tests
    if (seen.has(yjsValue)) {
      throw failure("Cannot clone an unparented Y.js value")
    }

    // If it's unparented and clone is true, but it's the first time we see it,
    // we can just return it as-is. It will be parented by the caller.
    seen.add(yjsValue)
    return yjsValue
  }

  if (!isObjectLike(value)) return value
  if (isMarkedAsJs(value)) return value

  if (seen.has(value)) {
    throw failure("Cyclic objects are not supported")
  }

  if (Array.isArray(value)) {
    const yarr = new Y.Array<unknown>()
    if (value.length > 0) {
      seen.add(value)
      const converted = value.map((item) => convertJsToYjsValue(item, seen))
      yarr.insert(0, converted)
      seen.delete(value)
    }
    return yarr
  }

  if (isPlainObject(value)) {
    seen.add(value)
    const ymap = new Y.Map<unknown>()
    for (const k of Object.keys(value)) {
      const v = (value as any)[k]
      const converted = convertJsToYjsValue(v, seen)
      ymap.set(k, converted)
    }
    seen.delete(value)
    return ymap
  }

  if (value instanceof Uint8Array) {
    return value
  }

  throw failure(
    `Unsupported value type: ${Object.prototype.toString.call(
      value
    )}. Only plain objects, arrays, Uint8Array and values marked with markAsJs are supported.`
  )
}

/**
 * Converts a Y.js value to its corresponding JS value (either a primitive or a proxy).
 *
 * @param value The Y.js value to convert.
 * @returns The corresponding JS value or proxy.
 * @throws {YjsProxyError} If the Y.js value is deleted.
 */
export function convertYjsToJsValue(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) {
    const yjsValue = value as Y.Map<any> | Y.Array<any>
    if (isYjsValueDeleted(yjsValue)) {
      throw failure("Cannot wrap a deleted Y.js value")
    }
    return wrapYjs(yjsValue)
  }
  if (isObjectLike(value)) {
    deepFreeze(value)
    markedAsJsValues.add(value)
  }
  return value
}
