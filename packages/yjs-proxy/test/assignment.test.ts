import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { unwrapYjs } from "../src"
import { wrapYjs } from "../src/wrapYjs"

describe("assignment behaviors", () => {
  test("assigning an attached proxy to another property creates an alias", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { val: 1 }
    const proxyA = root.a

    // Assigning attached proxy to another key
    root.b = root.a

    expect(root.b).toEqual({ val: 1 })
    expect(root.b).not.toBe(proxyA) // Should be a different proxy (backing a clone)

    // With aliasing, modifying one DOES affect the other
    root.b.val = 2
    expect(root.a.val).toBe(2)
    expect(root.b.val).toBe(2)
  })

  test("assigning a detached proxy to multiple locations creates aliases", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const detached = wrapYjs<any>(new Y.Map())
    detached.val = 1

    // Assign same detached proxy to two locations
    root.a = detached
    root.b = detached

    expect(root.a.val).toBe(1)
    expect(root.b.val).toBe(1)

    // Since it was detached, the first assignment attached it.
    // The second assignment cloned it and created an alias.
    expect(root.a).not.toBe(root.b)

    // With aliasing, modifying one DOES affect the other
    root.a.val = 2
    expect(root.b.val).toBe(2)
    expect(detached.val).toBe(2) // The original proxy is now attached to root.a
  })

  test("moving a proxy within the same document", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { val: 1 }
    const proxyA = root.a

    // Move it
    root.b = proxyA
    delete root.a

    expect(root.b.val).toBe(1)
    expect(root.a).toBeUndefined()

    // Note: proxyA is now detached because it was deleted from root.a
    // But root.b is a CLONE that is ALIASED with proxyA.
    // With cross-mode aliasing, mutations sync between attached and detached aliases!

    proxyA.val = 10
    expect(root.b.val).toBe(10) // root.b syncs with detached proxyA

    root.b.val = 20
    expect(proxyA.val).toBe(20) // proxyA syncs with attached root.b
  })

  test("assigning a proxy to itself is a no-op", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { val: 1 }
    const proxyA = root.a

    root.a = proxyA
    expect(root.a).toBe(proxyA)
    expect(root.a.val).toBe(1)
  })

  test("assigning a nested proxy to a parent property creates alias (circular-ish)", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { b: { c: 1 } }
    const proxyC = root.a.b

    // This should clone root.a.b, set it to root.x, and create an alias
    root.x = proxyC

    expect(root.x.c).toBe(1)
    expect(root.x).not.toBe(proxyC)

    // With aliasing, modifying one DOES affect the other
    root.x.c = 2
    expect(proxyC.c).toBe(2)
  })

  test("assigning the same plain JS object to multiple array positions creates aliases", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    // Create a plain JS object
    const a = { x: 1 }

    // Assign array containing the same object reference twice
    root.arr = [a, a]

    // At this point, the plain JS object `a` was converted to Yjs (Y.Map)
    // and the two Y.Maps are linked as aliases.

    // Modifying the original plain JS object has NO effect on the Yjs data
    // (it's disconnected after conversion)
    a.x++
    expect(a.x).toBe(2) // Original JS object is now 2
    expect(root.arr[0].x).toBe(1) // Yjs copy is still 1
    expect(root.arr[1].x).toBe(1) // Yjs copy is still 1

    // Modifying through a proxy affects ALL alias positions!
    root.arr[0].x++
    expect(root.arr[0].x).toBe(2) // First position is now 2
    expect(root.arr[1].x).toBe(2) // Second position is ALSO 2 (alias sync!)

    // The two array elements are still separate Y.Map instances in Yjs,
    // but their mutations are synchronized at runtime
    expect(unwrapYjs(root.arr[0])).not.toBe(unwrapYjs(root.arr[1]))
  })

  test("assigning the same plain JS object to multiple map properties separately DOES create aliases", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    // Create a plain JS object
    const a = { x: 1 }

    // Assign the same object to two properties in SEPARATE operations
    // Global tracking now links them as aliases!
    root.first = a
    root.second = a

    expect(root.first.x).toBe(1)
    expect(root.second.x).toBe(1)
    expect(unwrapYjs(root.first)).not.toBe(unwrapYjs(root.second))

    // Modifying original JS object still has no effect (it's plain JS)
    a.x++
    expect(root.first.x).toBe(1)
    expect(root.second.x).toBe(1)

    // But modifying one proxy DOES affect the other (alias sync!)
    root.first.x = 10
    expect(root.first.x).toBe(10)
    expect(root.second.x).toBe(10) // Synced!
  })

  test("assigning object with same reference twice in single conversion creates aliases", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    // Create a plain JS object
    const a = { x: 1 }

    // Assign an object containing the same reference twice in ONE operation
    root.data = { first: a, second: a }

    expect(root.data.first.x).toBe(1)
    expect(root.data.second.x).toBe(1)

    // The two are aliases - modifying one syncs to the other!
    root.data.first.x = 10
    expect(root.data.first.x).toBe(10)
    expect(root.data.second.x).toBe(10) // Synced!
  })

  test("deleting a property from an aliased object syncs to siblings", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const a = { x: 1, y: 2 }
    root.arr = [a, a]

    expect(root.arr[0].y).toBe(2)
    expect(root.arr[1].y).toBe(2)

    // Delete from one - should sync to the other
    delete root.arr[0].y
    expect(root.arr[0].y).toBeUndefined()
    expect(root.arr[1].y).toBeUndefined() // Also deleted!
  })

  test("nested aliases work recursively", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const inner = { val: 1 }
    const outer = { inner }

    // outer.inner is the same reference - should be aliased
    root.data = { a: outer, b: outer }

    expect(root.data.a.inner.val).toBe(1)
    expect(root.data.b.inner.val).toBe(1)

    // Modifying the deeply nested value should sync
    root.data.a.inner.val = 99
    expect(root.data.a.inner.val).toBe(99)
    expect(root.data.b.inner.val).toBe(99) // Synced!
  })

  test("aliasing works after detach and re-attach", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const a = { x: 1 }

    // Create initial aliases
    root.first = a
    root.second = a

    expect(root.first.x).toBe(1)
    expect(root.second.x).toBe(1)

    // Verify they're aliased
    root.first.x = 5
    expect(root.second.x).toBe(5)

    // Delete one
    delete root.first

    // Re-attach the same JS object
    root.third = a

    // The new attachment should still be aliased with root.second
    root.second.x = 10
    expect(root.third.x).toBe(10) // Should be synced!

    root.third.x = 20
    expect(root.second.x).toBe(20) // Should be synced!
  })

  test("aliasing persists when alias is removed from group", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const a = { x: 1 }

    // Create three aliases
    root.a = a
    root.b = a
    root.c = a

    // All should sync
    root.a.x = 5
    expect(root.b.x).toBe(5)
    expect(root.c.x).toBe(5)

    // Remove one alias
    delete root.b

    // Remaining aliases should still sync
    root.a.x = 10
    expect(root.c.x).toBe(10)

    root.c.x = 20
    expect(root.a.x).toBe(20)
  })

  test("pushing to array then assigning element elsewhere creates alias", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.arr = [] as any[]
    root.arr.push({ x: 1 })

    // Now assign the array element to another property
    root.second = root.arr[0]

    expect(root.arr[0].x).toBe(1)
    expect(root.second.x).toBe(1)

    // Modifying through root.second should update root.arr[0]
    root.second.x++
    expect(root.second.x).toBe(2)
    expect(root.arr[0].x).toBe(2) // Synced!

    // And vice versa
    root.arr[0].x = 100
    expect(root.second.x).toBe(100) // Synced!
  })
})
