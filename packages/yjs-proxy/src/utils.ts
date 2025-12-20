import * as Y from "yjs"
import { StringKeyedObject } from "./types"

/**
 * Checks if a value is object-like (not null and type is 'object').
 *
 * @param value The value to check.
 * @returns `true` if the value is object-like, `false` otherwise.
 */
export function isObjectLike(value: unknown): value is object {
  return value !== null && typeof value === "object"
}

/**
 * Checks if a value is a plain JavaScript object.
 *
 * @param value The value to check.
 * @returns `true` if the value is a plain object, `false` otherwise.
 */
export function isPlainObject(value: unknown): value is StringKeyedObject {
  if (!isObjectLike(value)) return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Checks if a Y.js value has been deleted or its document destroyed.
 *
 * @param yjsValue The Y.js value to check.
 * @returns `true` if the value is deleted or destroyed, `false` otherwise.
 */
export function isYjsValueDeleted(yjsValue: Y.AbstractType<any>): boolean {
  return !!(yjsValue as any)._item?.deleted || !!yjsValue.doc?.isDestroyed
}

/**
 * Executes a function within a Y.js transaction if the value is attached to a document.
 *
 * @param yjsValue The Y.js value to check for a document.
 * @param fn The function to execute.
 * @returns The result of the function.
 */
export function transactIfPossible<T>(yjsValue: Y.Map<any> | Y.Array<any>, fn: () => T): T {
  const doc = (yjsValue as any).doc
  if (doc) {
    let result: T
    doc.transact(() => {
      result = fn()
    })
    return result!
  }
  return fn()
}

/**
 * Deeply freezes a plain object or array.
 *
 * @param obj The object or array to freeze.
 * @returns The frozen object or array.
 */
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
