/**
 * A function that applies an inverse operation to undo a mutation.
 * Executed through proxy operations to maintain proper proxy state.
 */
export type InverseOp = () => void

/**
 * Context for managing rollback operations during a transaction.
 * @internal
 */
export interface RollbackContext {
  /** Whether rollback is still possible (proxies not invalidated, not currently rolling back) */
  readonly canRollback: boolean
  /** Log an inverse operation */
  log(op: InverseOp): void
  /** Mark that rollback is no longer possible (proxies invalidated) */
  invalidate(): void
  /** Execute all logged inverse operations in reverse order */
  executeRollback(): void
}

let activeRollbackContext: RollbackContext | null = null

/**
 * Gets the current rollback context, if any.
 * @internal
 */
export function getRollbackContext(): RollbackContext | undefined {
  return activeRollbackContext ?? undefined
}

/**
 * Sets the active rollback context.
 * @internal
 */
export function setRollbackContext(ctx: RollbackContext | null): void {
  activeRollbackContext = ctx
}

/**
 * Creates a new rollback context for tracking inverse operations.
 * @internal
 */
export function createRollbackContext(): RollbackContext {
  const ops: InverseOp[] = []
  let canRollback = true

  return {
    get canRollback() {
      return canRollback
    },

    log: (op) => {
      if (canRollback) {
        ops.push(op)
      }
    },

    invalidate: () => {
      canRollback = false
      ops.length = 0 // Clear ops to free memory
    },

    executeRollback: () => {
      if (!canRollback) return

      // Disable logging during rollback to prevent capturing inverse-of-inverse ops
      canRollback = false

      // Apply inverse operations in reverse order
      for (let i = ops.length - 1; i >= 0; i--) {
        ops[i]()
      }

      // Clear array when done
      ops.length = 0
    },
  }
}
