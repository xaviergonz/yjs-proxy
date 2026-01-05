import * as Y from "yjs"
import { removeProxyFromCache } from "./cache"
import { failure } from "./error/failure"
import { createRollbackContext, getRollbackContext, setRollbackContext } from "./rollback"
import type { YjsProxiableValue } from "./types"
import { wrapYjs } from "./wrapYjs"

/**
 * Transaction mode for `withYjsProxy`.
 * - `'auto'`: Synchronous only, wrapped in Yjs transaction.
 * - `'manual'`: Synchronous and async support, external change detection.
 */
export type TransactionMode = "auto" | "manual"

/**
 * Options for auto transaction mode.
 */
export interface AutoModeOptions {
  transactionMode?: "auto"
  /** Custom transaction origin (auto-generated symbol if not provided) */
  origin?: unknown
  /** If true, rolls back Y.js changes if the callback throws. Default: false */
  rollbackOnError?: boolean
}

/**
 * Options for manual transaction mode.
 */
export interface ManualModeOptions {
  transactionMode: "manual"
  /** Custom transaction origin (auto-generated symbol if not provided) */
  origin?: unknown
  /** If true, rolls back Y.js changes if the callback throws. Default: false */
  rollbackOnError?: boolean
}

/**
 * Context provided to callbacks in manual transaction mode.
 */
export interface ManualModeContext {
  /**
   * Wraps operations in a Yjs transaction with the scope's origin.
   * Use to batch multiple changes into a single transaction.
   */
  transact: <R>(fn: () => R) => R
  /**
   * Returns `true` if external Yjs changes were detected and proxies were invalidated.
   */
  isProxyInvalidated: () => boolean
}

// ============================================================================
// Scope State
// ============================================================================

interface ScopeState {
  mode: TransactionMode
  origin: unknown
  revokers: Map<object, () => void>
  invalidated: boolean
  observers: Map<Y.AbstractType<any>, (events: Y.YEvent<any>[], tx: Y.Transaction) => void>
}

let activeScope: ScopeState | null = null

/**
 * Checks if we are currently inside a `withYjsProxy` scope.
 * @internal
 */
export function isInScope(): boolean {
  return activeScope !== null
}

/**
 * Gets the current scope's transaction origin, or undefined if not in a scope.
 * @internal
 */
export function getScopeOrigin(): unknown {
  return activeScope?.origin
}

/**
 * Runs a function wrapped in transactions for all provided docs.
 * Uses recursive nesting so all docs have an active transaction.
 */
function transactAllDocs<R>(docs: Set<Y.Doc>, origin: unknown, fn: () => R): R {
  if (docs.size === 0) {
    return fn()
  }
  const docsArray = Array.from(docs)
  let result: R
  const runNested = (index: number): void => {
    if (index >= docsArray.length) {
      result = fn()
    } else {
      docsArray[index].transact(() => runNested(index + 1), origin)
    }
  }
  runNested(0)
  return result!
}

/**
 * Registers a revocable proxy for the current scope.
 * When the scope ends, the revoke function will be called.
 * @internal
 */
export function registerRevocableProxy(proxy: object, revoke: () => void): void {
  if (activeScope) {
    activeScope.revokers.set(proxy, revoke)
  }
}

// ============================================================================
// API Overloads - Single Value
// ============================================================================

/**
 * Provides scoped access to a Yjs value as a proxy.
 * Auto mode: synchronous only, wrapped in Yjs transaction.
 */
export function withYjsProxy<Draft = never>(
  yValue: YjsProxiableValue,
  callback: (proxy: Draft) => void,
  options?: AutoModeOptions
): void

/**
 * Manual mode: synchronous callback with context.
 */
export function withYjsProxy<Draft = never>(
  yValue: YjsProxiableValue,
  callback: (proxy: Draft, ctx: ManualModeContext) => void,
  options: ManualModeOptions
): void

/**
 * Manual mode: async callback with context.
 */
export function withYjsProxy<Draft = never>(
  yValue: YjsProxiableValue,
  callback: (proxy: Draft, ctx: ManualModeContext) => Promise<void>,
  options: ManualModeOptions
): Promise<void>

// ============================================================================
// API Overloads - Array of Values
// ============================================================================

/**
 * Auto mode with multiple values.
 */
export function withYjsProxy<Draft extends readonly unknown[] = never[]>(
  yValues: readonly YjsProxiableValue[],
  callback: (proxies: Draft) => void,
  options?: AutoModeOptions
): void

/**
 * Manual mode with multiple values: synchronous callback.
 */
export function withYjsProxy<Draft extends readonly unknown[] = never[]>(
  yValues: readonly YjsProxiableValue[],
  callback: (proxies: Draft, ctx: ManualModeContext) => void,
  options: ManualModeOptions
): void

/**
 * Manual mode with multiple values: async callback.
 */
export function withYjsProxy<Draft extends readonly unknown[] = never[]>(
  yValues: readonly YjsProxiableValue[],
  callback: (proxies: Draft, ctx: ManualModeContext) => Promise<void>,
  options: ManualModeOptions
): Promise<void>

// ============================================================================
// Implementation
// ============================================================================

export function withYjsProxy<Draft>(
  yValueOrValues: YjsProxiableValue | readonly YjsProxiableValue[],
  callback:
    | ((proxy: Draft) => void | Promise<void>)
    | ((proxy: Draft, ctx: ManualModeContext) => void | Promise<void>),
  options?: AutoModeOptions | ManualModeOptions
): void | Promise<void> {
  if (activeScope) {
    throw failure(
      "Cannot nest withYjsProxy calls. Pass all needed Yjs values as an array to a single withYjsProxy call."
    )
  }

  const values = Array.isArray(yValueOrValues) ? yValueOrValues : [yValueOrValues]
  const mode: TransactionMode = options?.transactionMode ?? "auto"
  const origin = options?.origin ?? Symbol("yjs-proxy")

  // Collect unique docs
  const docs = new Set<Y.Doc>()
  for (const v of values) {
    const doc = v.doc
    if (doc) {
      docs.add(doc)
    }
  }

  // Enter scope
  activeScope = {
    mode,
    origin,
    revokers: new Map(),
    invalidated: false,
    observers: new Map(),
  }

  const scope = activeScope

  // Create proxies
  const proxies = values.map((v) => wrapYjs(v))
  const proxyArg = (Array.isArray(yValueOrValues) ? proxies : proxies[0]) as Draft

  // Cleanup function
  const cleanup = () => {
    // Remove observers
    for (const [yValue, observer] of scope.observers) {
      yValue.unobserveDeep(observer)
    }

    // Revoke all proxies and remove from cache
    for (const [proxy, revoke] of scope.revokers) {
      revoke()
      removeProxyFromCache(proxy)
    }

    // Exit scope
    if (activeScope === scope) {
      activeScope = null
    }
  }

  // Manual mode context
  const ctx: ManualModeContext = {
    transact: <R>(fn: () => R): R => {
      if (scope.invalidated) {
        throw failure("Proxy invalidated: cannot transact after external Yjs changes")
      }
      return transactAllDocs(docs, origin, fn)
    },
    isProxyInvalidated: () => scope.invalidated,
  }

  // Set up rollback context if enabled
  const rollbackEnabled = options?.rollbackOnError ?? false
  const rollbackCtx = rollbackEnabled ? createRollbackContext() : null

  if (rollbackCtx) {
    setRollbackContext(rollbackCtx)
  }

  // Helper to execute rollback if enabled and possible
  const doRollback = () => {
    if (rollbackCtx?.canRollback) {
      transactAllDocs(docs, origin, () => {
        rollbackCtx.executeRollback()
      })
    }
  }

  // Helper to clean up rollback context and scope
  const doCleanup = () => {
    if (rollbackCtx) {
      setRollbackContext(null)
    }
    cleanup()
  }

  if (mode === "manual") {
    // Set up deep observers for external change detection
    for (const v of values) {
      const observer = (_events: Y.YEvent<any>[], tx: Y.Transaction) => {
        if (tx.origin !== origin && !scope.invalidated) {
          scope.invalidated = true

          // Invalidate rollback context - proxies are being revoked
          getRollbackContext()?.invalidate()

          // Revoke proxies for this scope
          for (const [proxy, revoke] of scope.revokers) {
            revoke()
            removeProxyFromCache(proxy)
          }
          scope.revokers.clear()
        }
      }
      v.observeDeep(observer)
      scope.observers.set(v, observer)
    }

    // Execute callback with context
    let isAsync = false
    try {
      const result = (callback as (proxy: Draft, ctx: ManualModeContext) => void | Promise<void>)(
        proxyArg,
        ctx
      )

      if (result instanceof Promise) {
        isAsync = true
        return result
          .catch((e) => {
            doRollback()
            throw e
          })
          .finally(doCleanup)
      }
      // Sync path - cleanup happens in finally below
    } catch (e) {
      doRollback()
      throw e
    } finally {
      // Only cleanup for sync path (Promise handles its own cleanup via .finally)
      if (!isAsync) {
        doCleanup()
      }
    }
  } else {
    // Auto mode - wrap in transaction
    try {
      transactAllDocs(docs, origin, () => {
        ;(callback as (proxy: Draft) => void)(proxyArg)
      })
    } catch (e) {
      doRollback()
      throw e
    } finally {
      doCleanup()
    }
  }
}
