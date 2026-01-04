import * as Y from "yjs"
import { dataToProxyCache, markedAsJsValues, setProxyState, tryGetProxyState } from "./cache"
import { failure } from "./error/failure"
import { isMarkedAsJs } from "./markAsJs"
import { jsObjectToFirstYjsValue, linkAliases } from "./sharedRefs"
import { tryUnwrapYjs } from "./unwrapYjs"
import { deepFreeze, isObjectLike, isPlainObject, isYjsValueDeleted } from "./utils"
import { wrapYjs } from "./wrapYjs"

/**
 * Context for tracking object identity during conversion.
 * Maps original JS objects to their first converted Y.js values within this conversion.
 * @internal
 */
interface ConversionContext {
  seen: WeakSet<object>
  /** Tracks objects within this single conversion (for cycle detection and local aliasing) */
  jsToYjs: WeakMap<object, Y.Map<any> | Y.Array<any>>
}

function createConversionContext(): ConversionContext {
  return {
    seen: new WeakSet(),
    jsToYjs: new WeakMap(),
  }
}

/**
 * Converts a JS value to a Y.js value.
 *
 * @param value The JS value to convert.
 * @param ctx The conversion context for tracking object identity.
 * @returns The converted Y.js value.
 */
export function convertJsToYjsValue(
  value: any,
  ctx: ConversionContext = createConversionContext()
): unknown {
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
        newYjsValue.set(k, convertJsToYjsValue(v, ctx))
      }
    } else {
      const converted = (json as any[]).map((item) => convertJsToYjsValue(item, ctx))
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
      const cloned = yjsValue.clone()
      // Link the original and clone as aliases so mutations propagate
      if (yjsValue instanceof Y.Map || yjsValue instanceof Y.Array) {
        linkAliases(yjsValue, cloned as Y.Map<any> | Y.Array<any>)
      }
      return cloned
    }
    // If it's unparented and we've seen it before, we MUST clone it to avoid
    // Yjs "already parented" errors, but we can't clone unparented types.
    // This does not happen in our unit tests
    if (ctx.seen.has(yjsValue)) {
      throw failure("Cannot clone an unparented Y.js value")
    }

    // If it's unparented and clone is true, but it's the first time we see it,
    // we can just return it as-is. It will be parented by the caller.
    ctx.seen.add(yjsValue)
    return yjsValue
  }

  if (!isObjectLike(value)) return value
  if (isMarkedAsJs(value)) return value

  if (ctx.seen.has(value)) {
    throw failure("Cyclic objects are not supported")
  }

  // Check if we've already converted this exact JS object:
  // 1. In this conversion pass (local context)
  // 2. In a previous conversion pass (global tracking)
  const localExisting = ctx.jsToYjs.get(value)
  const globalExisting = jsObjectToFirstYjsValue.get(value)
  const existingYjsValue = localExisting ?? globalExisting

  if (Array.isArray(value)) {
    ctx.seen.add(value)
    const yarr = new Y.Array<unknown>()

    // Track alias if this is a second occurrence
    if (existingYjsValue) {
      linkAliases(existingYjsValue, yarr)
    }
    // Always track in local context for this conversion
    if (!localExisting) {
      ctx.jsToYjs.set(value, yarr)
    }
    // Track globally for cross-conversion aliasing
    if (!globalExisting) {
      jsObjectToFirstYjsValue.set(value, yarr)
    }

    if (value.length > 0) {
      const converted = value.map((item) => convertJsToYjsValue(item, ctx))
      yarr.insert(0, converted)
    }
    ctx.seen.delete(value)
    return yarr
  }

  if (isPlainObject(value)) {
    ctx.seen.add(value)
    const ymap = new Y.Map<unknown>()

    // Track alias if this is a second occurrence
    if (existingYjsValue) {
      linkAliases(existingYjsValue, ymap)
    }
    // Always track in local context for this conversion
    if (!localExisting) {
      ctx.jsToYjs.set(value, ymap)
    }
    // Track globally for cross-conversion aliasing
    if (!globalExisting) {
      jsObjectToFirstYjsValue.set(value, ymap)
    }

    for (const k of Object.keys(value)) {
      const v = (value as any)[k]
      const converted = convertJsToYjsValue(v, ctx)
      ymap.set(k, converted)
    }
    ctx.seen.delete(value)
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
