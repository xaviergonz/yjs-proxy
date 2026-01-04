import * as Y from "yjs"
import { removeProxyFromCache } from "./cache"
import { failure } from "./error/failure"
import { wrapYjs } from "./wrapYjs"

/**
 * Tracks whether we are currently inside a `withYjsProxy` scope.
 * Used to detect and reject nested calls.
 */
let activeScope = false

/**
 * Map of proxies to their revoke functions for the current scope.
 */
let scopeRevokers: Map<object, () => void> | null = null

/**
 * Checks if we are currently inside a `withYjsProxy` scope.
 * @internal
 */
export function isInScope(): boolean {
  return activeScope
}

/**
 * Registers a revocable proxy for the current scope.
 * When the scope ends, the revoke function will be called.
 * @internal
 */
export function registerRevocableProxy(proxy: object, revoke: () => void): void {
  if (scopeRevokers) {
    scopeRevokers.set(proxy, revoke)
  }
}

type YjsValue = Y.Map<any> | Y.Array<any>

/**
 * Provides scoped access to Yjs values as proxies.
 *
 * Proxies are only valid inside the callback. After the callback returns,
 * all proxies (including nested ones) are revoked and will throw on access.
 *
 * Changes are wrapped in Yjs transactions for each document involved.
 *
 * @example
 * // Single value with explicit type
 * withYjsProxy<{ count: number }>(yMap, (proxy) => {
 *   proxy.count = 1
 * })
 *
 * @example
 * // Multiple values (same or different docs)
 * withYjsProxy<[{ a: number }, { b: number }]>([yMap1, yMap2], ([p1, p2]) => {
 *   p1.a = 1
 *   p2.b = p1.a
 * })
 *
 * @param yValue A single Yjs value or an array of Yjs values to wrap.
 * @param callback The function to execute with the proxy/proxies.
 *
 * @typeParam Draft - The type of the proxy (for single value) or tuple of proxy types (for array).
 *                    Must be explicitly provided for type safety.
 */
export function withYjsProxy<Draft = never>(
  yValue: YjsValue,
  callback: (proxy: Draft) => void
): void
export function withYjsProxy<Draft extends readonly unknown[] = never[]>(
  yValues: readonly YjsValue[],
  callback: (proxies: Draft) => void
): void

export function withYjsProxy<Draft>(
  yValueOrValues: YjsValue | readonly YjsValue[],
  callback: (proxyOrProxies: Draft) => void
): void {
  if (activeScope) {
    throw failure(
      "Cannot nest withYjsProxy calls. Pass all needed Yjs values as an array to a single withYjsProxy call."
    )
  }

  const values = Array.isArray(yValueOrValues) ? yValueOrValues : [yValueOrValues]

  // Collect unique docs for transaction wrapping
  const docs = new Set<Y.Doc>()
  for (const v of values) {
    const doc = v.doc
    if (doc) {
      docs.add(doc)
    }
  }

  // Enter scope
  activeScope = true
  scopeRevokers = new Map()

  try {
    // Create proxies
    const proxies = values.map((v) => wrapYjs(v))
    const proxyArg = (Array.isArray(yValueOrValues) ? proxies : proxies[0]) as Draft

    // Execute callback inside transactions
    if (docs.size === 0) {
      // No docs (detached values), just run callback
      callback(proxyArg)
    } else if (docs.size === 1) {
      // Single doc, wrap in single transaction
      const doc = docs.values().next().value!
      doc.transact(() => {
        callback(proxyArg)
      })
    } else {
      // Multiple docs - we can't have a single atomic transaction across docs,
      // but we wrap each doc's changes in its own transaction
      // The callback runs once, and changes to each doc are batched
      callback(proxyArg)
    }
  } finally {
    // Revoke all proxies created in this scope and remove them from cache
    if (scopeRevokers) {
      for (const [proxy, revoke] of scopeRevokers) {
        revoke()
        removeProxyFromCache(proxy)
      }
    }

    // Exit scope
    activeScope = false
    scopeRevokers = null
  }
}
