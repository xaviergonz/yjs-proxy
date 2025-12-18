import * as Y from "yjs"
import { markedAsJsValues } from "./cache"
import { failure } from "./error/failure"
import { isMarkedAsJs } from "./markAsJs"
import { unwrapYjs } from "./unwrapYjs"
import { deepFreeze, isObjectLike, isPlainObject, isYArray, isYMap } from "./utils"
import { wrapYjs } from "./wrapYjs"

function cloneYjsTypeIfParented<T extends Y.Map<any> | Y.Array<any>>(yType: T): T {
  if (yType.parent !== null || yType.doc !== null) {
    return yType.clone() as T
  }
  return yType
}

export function convertJsToYjsValue(
  value: any,
  contextYType: Y.Map<any> | Y.Array<any>,
  seen: WeakSet<object>
): unknown {
  const unwrapped = unwrapYjs(value)
  if (unwrapped) {
    return cloneYjsTypeIfParented(unwrapped)
  }

  if (isYMap(value) || isYArray(value)) {
    return cloneYjsTypeIfParented(value)
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
      const converted = value.map((item) => convertJsToYjsValue(item, contextYType, seen))
      yarr.insert(0, converted)
      seen.delete(value)
    }
    return yarr
  }

  if (isPlainObject(value)) {
    seen.add(value)
    const ymap = new Y.Map<unknown>()
    for (const [k, v] of Object.entries(value)) {
      ymap.set(k, convertJsToYjsValue(v, contextYType, seen))
    }
    seen.delete(value)
    return ymap
  }

  return value
}

export function convertYjsToJsValue(value: unknown): unknown {
  if (isYMap(value) || isYArray(value)) {
    return wrapYjs(value as any)
  }
  if (isObjectLike(value)) {
    deepFreeze(value)
    markedAsJsValues.add(value)
  }
  return value
}
