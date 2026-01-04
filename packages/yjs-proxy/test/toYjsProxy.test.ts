import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import { isYjsProxy, toYjsProxy, unwrapYjs } from "../src"
import { wrapYjs } from "../src/wrapYjs"

describe("toYjsProxy", () => {
  it("should convert a plain object to a proxy in JSON mode", () => {
    const o = { a: 1 }
    const wrappedO = toYjsProxy(o)

    expect(wrappedO.a).toBe(1)
    wrappedO.a++
    expect(wrappedO.a).toBe(2)
    expect(o.a).toBe(1) // Original should not be affected

    expect(unwrapYjs(wrappedO)).toBeUndefined()
  })

  it("should support bigint cloning", () => {
    const o = { a: 1n }
    const wrappedO = toYjsProxy(o)

    expect(wrappedO.a).toBe(1n)
    wrappedO.a = 2n
    expect(wrappedO.a).toBe(2n)
    expect(o.a).toBe(1n)
  })

  it("should support nested objects and preserve identity", () => {
    const o = { a: { b: 1 } }
    const wrappedO = toYjsProxy(o)

    const nested = wrappedO.a
    expect(nested.b).toBe(1)
    expect(wrappedO.a).toBe(nested) // Identity preservation
    expect(isYjsProxy(wrappedO.a)).toBe(true)

    nested.b = 2
    expect(wrappedO.a.b).toBe(2)
  })

  it("should preserve nested identity during re-attachment", () => {
    const o = { a: { b: 1 } }
    const wrappedO = toYjsProxy(o)
    const child = wrappedO.a

    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap())
    root.obj = wrappedO

    expect(root.obj).toBe(wrappedO)
    expect(root.obj.a).toBe(child)
    expect(root.obj.a.b).toBe(1)

    root.obj.a.b = 2
    expect(child.b).toBe(2)
  })

  it("should re-attach correctly when assigned to a doc", () => {
    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap())
    const o = { a: 1 }
    const wrappedO = toYjsProxy(o)

    wrappedO.a = 2
    root.x = wrappedO

    expect(root.x).toBe(wrappedO)
    expect(doc.getMap().get("x")).toBeInstanceOf(Y.Map)
    expect((doc.getMap().get("x") as Y.Map<{ a: number }>).toJSON()).toEqual({ a: 2 })
    expect(wrappedO.a).toBe(2)

    wrappedO.a = 3
    expect((doc.getMap().get("x") as Y.Map<{ a: number }>).get("a")).toBe(3)
  })

  it("should support arrays", () => {
    const arr = [1, { a: 1 }]
    const wrappedArr = toYjsProxy<any[]>(arr)

    expect(wrappedArr[0]).toBe(1)
    expect(wrappedArr[1].a).toBe(1)

    wrappedArr[0] = 2
    wrappedArr[1].a = 2

    expect((arr[1] as any).a).toBe(1)

    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap())
    root.arr = wrappedArr

    expect((doc.getMap().get("arr") as Y.Array<any>).toJSON()).toEqual([2, { a: 2 }])
  })

  it("should support clone: false", () => {
    const o = { a: 1, nested: { b: 2 } }
    const wrappedO = toYjsProxy(o, { clone: false })

    expect(wrappedO.a).toBe(1)
    wrappedO.a = 10
    expect(o.a).toBe(10) // Original SHOULD be affected

    const nested = wrappedO.nested
    nested.b = 20
    expect(o.nested.b).toBe(20) // Original nested SHOULD be affected

    // Re-attachment should still work
    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap())
    root.obj = wrappedO

    root.obj.a = 100
    expect(o.a).toBe(10) // Once attached, it's no longer in JSON mode, so original is no longer affected
    expect(root.obj.a).toBe(100)
  })

  it("should return the same proxy if already a proxy", () => {
    const p = toYjsProxy({ a: 1 })
    expect(toYjsProxy(p)).toBe(p)
  })
})
