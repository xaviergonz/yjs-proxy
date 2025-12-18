import * as Y from "yjs"
import { StringKeyedObject } from "./types"

export function isObjectLike(value: unknown): value is object {
  return typeof value === "object" && value !== null
}

export function isPlainObject(value: unknown): value is StringKeyedObject {
  if (!isObjectLike(value)) return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function isYMap(value: unknown): value is Y.Map<unknown> {
  return value instanceof Y.Map
}

export function isYArray(value: unknown): value is Y.Array<unknown> {
  return value instanceof Y.Array
}

export function transactIfPossible<T>(yType: Y.Map<any> | Y.Array<any>, fn: () => T): T {
  const doc = (yType as any).doc
  if (doc) {
    let result: T
    doc.transact(() => {
      result = fn()
    })
    return result!
  }
  return fn()
}

export function deepFreeze<T>(obj: T): T {
  if (!isObjectLike(obj) || Object.isFrozen(obj)) {
    return obj
  }

  // Only freeze plain objects and arrays
  if (!isPlainObject(obj) && !Array.isArray(obj)) {
    return obj
  }

  Object.freeze(obj)

  const props = Reflect.ownKeys(obj)
  for (const prop of props) {
    const val = (obj as any)[prop]
    if (isObjectLike(val) && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  }

  return obj
}
