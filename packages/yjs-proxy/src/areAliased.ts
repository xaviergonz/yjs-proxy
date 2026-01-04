import { tryGetProxyState } from "./cache"
import { areProxiesAliased, areYjsValuesAliased } from "./sharedRefs"
import type { YjsProxy } from "./types"

/**
 * Checks if two `yjs-proxy` proxies are aliases of each other.
 *
 * Two proxies are aliased if they originated from the same JS object reference
 * during conversion(s) and mutations to one will propagate to the other.
 * This happens when:
 * - The same plain JS object is assigned to multiple locations
 * - An existing proxy is assigned to another location (cloned and linked)
 *
 * Note: Aliasing only works within the same `Y.Doc`. Cross-document assignments
 * create independent clones that are not aliased.
 *
 * @param a First proxy
 * @param b Second proxy
 * @returns `true` if the proxies are aliased, `false` otherwise
 *
 * @example
 * ```ts
 * const obj = { x: 1 }
 * state.a = obj
 * state.b = obj
 *
 * areAliased(state.a, state.b) // true
 *
 * state.a.x = 10
 * console.log(state.b.x) // 10 — synced!
 * ```
 */
export function areAliased(a: object, b: object): boolean {
  const stateA = tryGetProxyState(a)
  const stateB = tryGetProxyState(b)

  // Both must be proxies
  if (!stateA || !stateB) return false

  // Check proxy-level aliasing (works for both attached and detached)
  if (areProxiesAliased(a as YjsProxy, b as YjsProxy)) {
    // For attached proxies, also verify they're in the same document
    if (stateA.attached && stateB.attached) {
      return stateA.yjsValue.doc === stateB.yjsValue.doc
    }
    // For detached proxies, proxy-level aliasing is sufficient
    return true
  }

  // For attached proxies, also check Y.js value aliasing
  if (stateA.attached && stateB.attached) {
    // If they're the same Y.js value, they're aliased
    if (stateA.yjsValue === stateB.yjsValue) return true

    // Check if they're in the same alias group and same document
    if (stateA.yjsValue.doc !== stateB.yjsValue.doc) return false

    return areYjsValuesAliased(stateA.yjsValue, stateB.yjsValue)
  }

  return false
}
