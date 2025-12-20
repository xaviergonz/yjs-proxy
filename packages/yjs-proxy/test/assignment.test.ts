import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { wrapYjs } from "../src/index"

describe("assignment behaviors", () => {
  test("assigning an attached proxy to another property clones it", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { val: 1 }
    const proxyA = root.a

    // Assigning attached proxy to another key
    root.b = root.a

    expect(root.b).toEqual({ val: 1 })
    expect(root.b).not.toBe(proxyA) // Should be a different proxy (backing a clone)

    // Modifying one should not affect the other
    root.b.val = 2
    expect(root.a.val).toBe(1)
    expect(root.b.val).toBe(2)
  })

  test("assigning a detached proxy to multiple locations", () => {
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
    // The second assignment should have cloned it.
    expect(root.a).not.toBe(root.b)

    root.a.val = 2
    expect(root.b.val).toBe(1)
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
    // But root.b is a CLONE of what proxyA was when it was assigned.
    // This is a subtle point: assignment happens BEFORE deletion in this sequence.

    proxyA.val = 10
    expect(root.b.val).toBe(1) // root.b is a clone
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

  test("assigning a nested proxy to a parent property (circular-ish)", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { b: { c: 1 } }
    const proxyC = root.a.b

    // This should clone root.a.b and set it to root.x
    root.x = proxyC

    expect(root.x.c).toBe(1)
    expect(root.x).not.toBe(proxyC)

    root.x.c = 2
    expect(proxyC.c).toBe(1)
  })
})
