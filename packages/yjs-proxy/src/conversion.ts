import * as Y from "yjs"
import { markedAsJsValues } from "./cache"
import { failure } from "./error/failure"
import { isMarkedAsJs } from "./markAsJs"
import { unwrapYjs } from "./unwrapYjs"
import { deepFreeze, isObjectLike, isPlainObject, isYArray, isYMap } from "./utils"
import { wrapYjs } from "./wrapYjs"

function isYTypeDeleted(yType: Y.Map<any> | Y.Array<any>): boolean {
  return !!(yType as any)._item?.deleted || !!yType.doc?.isDestroyed
}

/**
 * Converts a JS value to a Yjs value.
 *
 * @param value The JS value to convert.
 * @returns The converted Yjs value.
 */
export function convertJsToYjsValue(value: any, seen: WeakSet<object> = new WeakSet()): unknown {
  const unwrapped = unwrapYjs(value)
  const yType = unwrapped ?? (isYMap(value) || isYArray(value) ? value : undefined)

  if (yType) {
    if (isYTypeDeleted(yType)) {
      throw failure("Cannot wrap a deleted Yjs type")
    }
    // We clone if already integrated (has a parent or doc)
    if (yType.parent !== null || yType.doc !== null) {
      return yType.clone()
    }
    // If it's unparented and we've seen it before, we MUST clone it to avoid
    // Yjs "already parented" errors, but we can't clone unparented types.
    // This does not happen in our unit tests
    if (seen.has(yType)) {
      throw failure("Cannot clone an unparented Yjs type")
    }

    // If it's unparented and clone is true, but it's the first time we see it,
    // we can just return it as-is. It will be parented by the caller.
    seen.add(yType)
    return yType
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
    for (const [k, v] of Object.entries(value)) {
      ymap.set(k, convertJsToYjsValue(v, seen))
    }
    seen.delete(value)
    return ymap
  }

  return value
}

export function convertYjsToJsValue(value: unknown, clone: boolean): unknown {
  if (isYMap(value) || isYArray(value)) {
    let yType = value as Y.Map<any> | Y.Array<any>
    if (isYTypeDeleted(yType)) {
      throw failure("Cannot wrap a deleted Yjs type")
    }
    if (clone) {
      if (yType.parent !== null || yType.doc !== null) {
        yType = yType.clone()
      }
    }
    return wrapYjs(yType)
  }
  if (isObjectLike(value)) {
    deepFreeze(value)
    markedAsJsValues.add(value)
  }
  return value
}
