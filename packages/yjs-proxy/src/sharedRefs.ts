import * as Y from "yjs"
import { dataToProxyCache, tryGetProxyState } from "./cache"
import type { YjsProxiableValue, YjsProxy } from "./types"
import { transactIfPossible } from "./utils"
import { getScopeOrigin } from "./withYjsProxy"

/**
 * Maps a Y.js value to its alias group (a set of Y.js values that should stay in sync).
 * When any member is mutated, the mutation is propagated to all siblings.
 * @internal
 */
export const aliasGroups = new WeakMap<Y.AbstractType<any>, Set<Y.AbstractType<any>>>()

/**
 * Maps a proxy to its alias group (a set of proxies that should stay in sync).
 * This is used to track aliases at the proxy level, which persists across attach/detach.
 * @internal
 */
export const proxyAliasGroups = new WeakMap<YjsProxy, Set<YjsProxy>>()

/**
 * Maps original JS objects to the first Y.js value created from them.
 * Used to track aliases across separate conversion operations.
 * @internal
 */
export const jsObjectToFirstYjsValue = new WeakMap<object, YjsProxiableValue>()

/**
 * Gets the alias group for a Y.js value, or undefined if it has no aliases.
 * @internal
 */
export function getAliasGroup(yjsValue: YjsProxiableValue): Set<Y.AbstractType<any>> | undefined {
  return aliasGroups.get(yjsValue)
}

/**
 * Links two Y.js values as aliases of each other.
 * Mutations to one will be propagated to the other.
 * @internal
 */
export function linkAliases(a: YjsProxiableValue, b: YjsProxiableValue): void {
  if (a === b) return // Same value, nothing to link

  const groupA = aliasGroups.get(a)
  const groupB = aliasGroups.get(b)

  if (groupA && groupB) {
    // Merge groups
    for (const member of groupB) {
      groupA.add(member)
      aliasGroups.set(member, groupA)
    }
  } else if (groupA) {
    groupA.add(b)
    aliasGroups.set(b, groupA)
  } else if (groupB) {
    groupB.add(a)
    aliasGroups.set(a, groupB)
  } else {
    // Create new group
    const group = new Set<Y.AbstractType<any>>([a, b])
    aliasGroups.set(a, group)
    aliasGroups.set(b, group)
  }
}

/**
 * Removes a Y.js value from its alias group (e.g., when deleted from document).
 * @internal
 */
export function unlinkAlias(yjsValue: YjsProxiableValue): void {
  const group = aliasGroups.get(yjsValue)
  if (!group) return

  group.delete(yjsValue)
  aliasGroups.delete(yjsValue)

  // If only one member left, clean up the group
  if (group.size === 1) {
    const remaining = group.values().next().value
    if (remaining) {
      aliasGroups.delete(remaining)
    }
  }
}

/**
 * Gets siblings (other members of the alias group) for a Y.js value.
 * Only returns siblings in the same Y.Doc (cross-doc aliases are ignored).
 * Returns empty array if no aliases.
 * @internal
 */
export function getAliasSiblings(yjsValue: YjsProxiableValue): YjsProxiableValue[] {
  const group = aliasGroups.get(yjsValue)
  if (!group || group.size <= 1) return []

  const sourceDoc = yjsValue.doc

  const siblings: YjsProxiableValue[] = []
  for (const member of group) {
    if (member !== yjsValue) {
      // Only include siblings in the same document (or both unparented)
      if (member.doc === sourceDoc) {
        siblings.push(member as YjsProxiableValue)
      }
    }
  }
  return siblings
}

/**
 * Checks if two Y.js values are aliases of each other (part of the same alias group).
 * Two values are aliases if they originated from the same JS object reference
 * during conversion(s) and mutations to one will propagate to the other.
 *
 * @param a First Y.js value (Y.Map or Y.Array)
 * @param b Second Y.js value (Y.Map or Y.Array)
 * @returns `true` if the values are aliases, `false` otherwise
 */
export function areYjsValuesAliased(a: YjsProxiableValue, b: YjsProxiableValue): boolean {
  if (a === b) return true
  const groupA = aliasGroups.get(a)
  return !!groupA?.has(b)
}

/**
 * Links two proxies as aliases of each other at the proxy level.
 * This is separate from Y.js value aliasing and persists across attach/detach.
 * @internal
 */
export function linkProxyAliases(a: YjsProxy, b: YjsProxy): void {
  if (a === b) return // Same proxy, nothing to link

  const groupA = proxyAliasGroups.get(a)
  const groupB = proxyAliasGroups.get(b)

  if (groupA && groupB) {
    // Merge groups
    for (const member of groupB) {
      groupA.add(member)
      proxyAliasGroups.set(member, groupA)
    }
  } else if (groupA) {
    groupA.add(b)
    proxyAliasGroups.set(b, groupA)
  } else if (groupB) {
    groupB.add(a)
    proxyAliasGroups.set(a, groupB)
  } else {
    // Create new group
    const group = new Set<YjsProxy>([a, b])
    proxyAliasGroups.set(a, group)
    proxyAliasGroups.set(b, group)
  }
}

/**
 * Gets proxy siblings (other members of the proxy alias group).
 * Returns empty array if no aliases.
 * @internal
 */
export function getProxyAliasSiblings(proxy: YjsProxy): YjsProxy[] {
  const group = proxyAliasGroups.get(proxy)
  if (!group || group.size <= 1) return []

  const siblings: YjsProxy[] = []
  for (const member of group) {
    if (member !== proxy) {
      siblings.push(member)
    }
  }
  return siblings
}

/**
 * Checks if two proxies are aliases of each other at the proxy level.
 * @internal
 */
export function areProxiesAliased(a: YjsProxy, b: YjsProxy): boolean {
  if (a === b) return true
  const groupA = proxyAliasGroups.get(a)
  return !!groupA?.has(b)
}

/**
 * Links a newly created proxy with sibling proxies from Y.js-level aliases.
 * Only links with siblings that already have proxies.
 *
 * @param proxy The newly created proxy
 * @param yjsValue The Y.js value the proxy wraps
 * @internal
 */
export function linkProxyWithExistingSiblings(proxy: YjsProxy, yjsValue: YjsProxiableValue): void {
  for (const sibling of getAliasSiblings(yjsValue)) {
    const siblingProxy = dataToProxyCache.get(sibling) as YjsProxy | undefined
    if (siblingProxy) {
      linkProxyAliases(proxy, siblingProxy)
    }
  }
}

/**
 * Applies operations to a proxy and all its alias siblings.
 * Handles both attached (Y.js) and detached (JSON) modes, applying the appropriate function
 * to the original and propagating to all siblings.
 *
 * Note: `linkProxyWithExistingSiblings` eagerly creates proxies for Y.js siblings that exist
 * at proxy creation time. However, new Y.js aliases can be created later, so we also check
 * Y.js-level siblings to ensure all aliases receive mutations.
 *
 * @param proxy The proxy to apply operations to
 * @param yjsFn Function to apply to attached Y.js values (Y.Map or Y.Array)
 * @param jsonFn Function to apply to detached JSON values (object or array)
 * @internal
 */
export function applyToAllAliases<T extends YjsProxiableValue, J extends object>(
  proxy: YjsProxy,
  yjsFn: (yjsValue: T) => void,
  jsonFn: (json: J) => void
): void {
  const state = tryGetProxyState(proxy)
  if (!state) return

  // Get all proxies in the alias group including self
  const allProxies = [proxy, ...getProxyAliasSiblings(proxy)]

  // Collect all Y.js values and JSON objects to process
  const yjsValues: T[] = []
  const jsonObjects: J[] = []
  const processedYjs = new Set<object>()
  const processedJson = new Set<object>()

  for (const p of allProxies) {
    const s = tryGetProxyState(p)
    if (!s) continue

    if (s.attached) {
      const yjsValue = s.yjsValue as T
      if (!processedYjs.has(yjsValue)) {
        processedYjs.add(yjsValue)
        yjsValues.push(yjsValue)

        // Also include Y.js-level siblings (may not have proxies yet if created after this proxy)
        for (const sibling of getAliasSiblings(yjsValue)) {
          if (!processedYjs.has(sibling)) {
            processedYjs.add(sibling)
            yjsValues.push(sibling as T)
          }
        }
      }
    } else {
      // Detached aliased proxies may share the same JSON object, so deduplicate
      const json = s.json as J
      if (!processedJson.has(json)) {
        processedJson.add(json)
        jsonObjects.push(json)
      }
    }
  }

  // Apply JSON mutations (no transaction needed)
  for (const json of jsonObjects) {
    jsonFn(json)
  }

  // Apply Y.js mutations in a single transaction
  if (yjsValues.length > 0) {
    transactIfPossible(
      yjsValues[0],
      () => {
        for (const yjsValue of yjsValues) {
          yjsFn(yjsValue)
        }
      },
      getScopeOrigin()
    )
  }
}
