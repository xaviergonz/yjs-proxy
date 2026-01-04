import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { areAliased } from "../src"
import { wrapYjs } from "../src/wrapYjs"

describe("areAliased", () => {
  test("returns true for same proxy", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { x: 1 }
    expect(areAliased(root.a, root.a)).toBe(true)
  })

  test("returns true for aliased proxies from same plain object", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const obj = { x: 1 }
    root.a = obj
    root.b = obj

    expect(areAliased(root.a, root.b)).toBe(true)
  })

  test("returns true for aliased proxies from assigning existing proxy", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { x: 1 }
    root.b = root.a

    expect(areAliased(root.a, root.b)).toBe(true)
  })

  test("returns false for different proxies", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { x: 1 }
    root.b = { x: 1 } // Different object with same value

    expect(areAliased(root.a, root.b)).toBe(false)
  })

  test("returns false for non-proxy values", () => {
    expect(areAliased({}, {})).toBe(false)
  })

  test("returns false for cross-document aliases", () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    const root1 = wrapYjs<any>(doc1.getMap())
    const root2 = wrapYjs<any>(doc2.getMap())

    root1.a = { x: 1 }
    root2.b = root1.a // Cloned to different doc

    // They're linked in the alias group, but areAliased should return false
    // because they're in different documents (mutations won't sync)
    expect(areAliased(root1.a, root2.b)).toBe(false)
  })

  test("mutations sync between aliased proxies", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const obj = { x: 1 }
    root.a = obj
    root.b = obj

    expect(areAliased(root.a, root.b)).toBe(true)

    root.a.x = 10
    expect(root.b.x).toBe(10)

    root.b.x = 20
    expect(root.a.x).toBe(20)
  })

  test("returns true for detached aliased proxies", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const obj = { x: 1 }
    root.a = obj
    root.b = obj

    // Keep references to the proxies before detaching
    const proxyA = root.a
    const proxyB = root.b

    expect(areAliased(proxyA, proxyB)).toBe(true)

    // Detach by deleting from root
    delete root.a
    delete root.b

    // Should still be aliased after detachment
    expect(areAliased(proxyA, proxyB)).toBe(true)
  })

  test("detached aliased proxies share mutations", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const obj = { x: 1 }
    root.a = obj
    root.b = obj

    const proxyA = root.a
    const proxyB = root.b

    // Detach both
    delete root.a
    delete root.b

    // Mutations should sync between detached aliases
    proxyA.x = 10
    expect(proxyB.x).toBe(10)

    proxyB.x = 20
    expect(proxyA.x).toBe(20)
  })

  test("partial detachment - mutations sync between attached and detached", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const obj = { x: 1 }
    root.a = obj
    root.b = obj

    const proxyA = root.a
    const proxyB = root.b

    // Only detach proxyA
    delete root.a

    // Mixed state: proxyA is detached, proxyB is still attached
    // They should still report as aliased
    expect(areAliased(proxyA, proxyB)).toBe(true)

    // Mutation through attached proxy should update detached
    root.b.x = 100
    expect(proxyA.x).toBe(100)

    // Mutation through detached proxy should update attached
    proxyA.x = 200
    expect(root.b.x).toBe(200)
  })

  test("three or more aliases with partial detachment", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const obj = { x: 1 }
    root.a = obj
    root.b = obj
    root.c = obj

    const proxyA = root.a
    const proxyB = root.b
    const proxyC = root.c

    expect(areAliased(proxyA, proxyB)).toBe(true)
    expect(areAliased(proxyB, proxyC)).toBe(true)
    expect(areAliased(proxyA, proxyC)).toBe(true)

    // Detach one (proxyB)
    delete root.b

    // All should still be aliased
    expect(areAliased(proxyA, proxyB)).toBe(true)
    expect(areAliased(proxyB, proxyC)).toBe(true)
    expect(areAliased(proxyA, proxyC)).toBe(true)

    // Mutations should propagate to all
    proxyA.x = 10
    expect(proxyB.x).toBe(10)
    expect(proxyC.x).toBe(10)

    // And from detached to attached
    proxyB.x = 20
    expect(proxyA.x).toBe(20)
    expect(proxyC.x).toBe(20)
  })

  test("re-attachment after detachment preserves aliasing", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const obj = { x: 1 }
    root.a = obj
    root.b = obj

    const proxyA = root.a
    const proxyB = root.b

    // Detach both
    delete root.a
    delete root.b

    // Modify while detached
    proxyA.x = 50

    // Re-attach proxyA - this creates a new Y.js value
    root.reattached = proxyA

    // The re-attached proxy should have the updated value
    expect(root.reattached.x).toBe(50)

    // proxyB (still detached) shares the same json
    expect(proxyB.x).toBe(50)

    // The re-attached and proxyB should still be aliased
    expect(areAliased(root.reattached, proxyB)).toBe(true)

    // Mutations should sync
    root.reattached.x = 100
    expect(proxyB.x).toBe(100)

    proxyB.x = 200
    expect(root.reattached.x).toBe(200)
  })

  test("array aliasing with detachment", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const arr = [1, 2, 3]
    root.arr1 = arr
    root.arr2 = arr

    const proxyArr1 = root.arr1
    const proxyArr2 = root.arr2

    expect(areAliased(proxyArr1, proxyArr2)).toBe(true)

    // Detach both
    delete root.arr1
    delete root.arr2

    expect(areAliased(proxyArr1, proxyArr2)).toBe(true)

    // Mutations should sync
    proxyArr1.push(4)
    expect(proxyArr2.length).toBe(4)
    expect(proxyArr2[3]).toBe(4)
  })

  test("nested aliased objects with detachment", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const inner = { val: 1 }
    const obj1 = { inner }
    const obj2 = { inner }

    root.a = obj1
    root.b = obj2

    const innerA = root.a.inner
    const innerB = root.b.inner

    // The inner objects should be aliased
    expect(areAliased(innerA, innerB)).toBe(true)

    // Detach both parents
    const proxyA = root.a
    const proxyB = root.b
    delete root.a
    delete root.b

    // Inner objects should still be aliased after parent detachment
    expect(areAliased(proxyA.inner, proxyB.inner)).toBe(true)
  })

  test("detached proxy with new property", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    const obj = { x: 1 }
    root.a = obj
    root.b = obj

    const proxyA = root.a
    const proxyB = root.b

    delete root.a
    delete root.b

    // Add new property through detached proxy
    proxyA.newProp = "hello"
    expect(proxyB.newProp).toBe("hello")

    // Delete property through detached proxy
    delete proxyA.x
    expect(proxyB.x).toBeUndefined()
  })

  test("detached then one is re-attached to different doc - still syncs via proxy aliases", () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    const root1 = wrapYjs<any>(doc1.getMap())
    const root2 = wrapYjs<any>(doc2.getMap())

    const obj = { x: 1 }
    root1.a = obj
    root1.b = obj

    const proxyA = root1.a
    const proxyB = root1.b

    // Detach both
    delete root1.a
    delete root1.b

    // Re-attach proxyA to a different document
    root2.a = proxyA

    // The re-attached proxy is now in a different doc
    // But they share proxy aliases, so mutations still sync!
    // (This is intentional - proxy-level aliasing persists across re-attachment)
    root2.a.x = 100
    expect(proxyB.x).toBe(100)

    proxyB.x = 200
    expect(root2.a.x).toBe(200)
  })

  test("same proxy assigned to itself after detachment", () => {
    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())

    root.a = { x: 1 }
    const proxy = root.a

    delete root.a

    // Re-attach
    root.a = proxy

    // Should work and be the same
    expect(root.a.x).toBe(1)
    expect(areAliased(root.a, proxy)).toBe(true)
  })
})
