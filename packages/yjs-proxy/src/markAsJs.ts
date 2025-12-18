import { markedAsJsValues } from "./cache"
import { deepFreeze } from "./utils"

/**
 * Marks a plain object/array to be stored in Yjs as-is (no conversion to `Y.Map` / `Y.Array`).
 *
 * This is an escape hatch when you explicitly want a raw JSON-ish object value.
 *
 * Note: `markAsJs` returns a deeply frozen shallow clone of the input value.
 * Note: Circular references in raw objects will cause Yjs to crash during synchronization.
 */
export function markAsJs<T extends object>(value: T): T {
  const clone = Array.isArray(value) ? [...value] : { ...value }
  deepFreeze(clone)
  markedAsJsValues.add(clone)
  return clone as T
}

/**
 * Returns true if the value is a plain object/array that is stored in Yjs as-is.
 */
export function isMarkedAsJs(value: unknown): boolean {
  return typeof value === "object" && value !== null && markedAsJsValues.has(value)
}
