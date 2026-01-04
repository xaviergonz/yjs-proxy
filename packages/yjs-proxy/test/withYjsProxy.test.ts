import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { withYjsProxy, yjsWrapperToJson } from "../src"

describe("withYjsProxy", () => {
  test("works inside callback", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    withYjsProxy<{ count: number; nested: { a: number } }>(ymap, (proxy) => {
      proxy.count = 1
      proxy.nested = { a: 2 }
      expect(proxy.count).toBe(1)
      expect(proxy.nested.a).toBe(2)
    })

    expect(ymap.get("count")).toBe(1)
    expect((ymap.get("nested") as Y.Map<any>).get("a")).toBe(2)
  })

  test("throws after callback (proxy revoked)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    let capturedProxy: { x: number; y?: number }

    withYjsProxy<{ x: number }>(ymap, (proxy) => {
      proxy.x = 1
      capturedProxy = proxy
    })

    expect(() => capturedProxy.x).toThrow("proxy that has been revoked")
    expect(() => {
      capturedProxy.y = 2
    }).toThrow("proxy that has been revoked")
    expect(() => Object.keys(capturedProxy)).toThrow("proxy that has been revoked")
  })

  test("nested proxies are also revoked after callback", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    let capturedNested: any

    withYjsProxy<{ nested: { a: number; deep: { b: number } } }>(ymap, (proxy) => {
      proxy.nested = { a: 1, deep: { b: 2 } }
      capturedNested = proxy.nested
      expect(capturedNested.a).toBe(1)
      expect(capturedNested.deep.b).toBe(2)
    })

    expect(() => capturedNested.a).toThrow("proxy that has been revoked")
  })

  test("multiple values (array form)", () => {
    const doc = new Y.Doc()
    const ymap1 = doc.getMap("m1")
    const ymap2 = doc.getMap("m2")
    const yarray = doc.getArray("a")

    withYjsProxy<[{ a: number }, { b: number }, number[]]>(
      [ymap1, ymap2, yarray],
      ([p1, p2, p3]) => {
        p1.a = 1
        p2.b = p1.a
        p3.push(p1.a)
      }
    )

    expect(ymap1.get("a")).toBe(1)
    expect(ymap2.get("b")).toBe(1)
    expect(yarray.get(0)).toBe(1)
  })

  test("multiple values from different docs", () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    const ymap1 = doc1.getMap("m1")
    const ymap2 = doc2.getMap("m2")

    withYjsProxy<[{ x: number }, { y: number }]>([ymap1, ymap2], ([p1, p2]) => {
      p1.x = 10
      p2.y = 20
    })

    expect(ymap1.get("x")).toBe(10)
    expect(ymap2.get("y")).toBe(20)
  })

  test("nesting throws", () => {
    const doc = new Y.Doc()
    const ymap1 = doc.getMap("m1")
    const ymap2 = doc.getMap("m2")

    expect(() => {
      withYjsProxy<{ a: number }>(ymap1, (p1) => {
        p1.a = 1
        withYjsProxy<{ b: number }>(ymap2, (p2) => {
          p2.b = 2
        })
      })
    }).toThrow("Cannot nest withYjsProxy calls")
  })

  test("transaction wrapping (single doc)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    const events: string[] = []
    doc.on("update", () => {
      events.push("update")
    })

    withYjsProxy<{ a: number; b: number; c: number }>(ymap, (proxy) => {
      proxy.a = 1
      proxy.b = 2
      proxy.c = 3
    })

    // Should have received exactly one update (all changes batched)
    expect(events.length).toBe(1)
  })

  test("works with arrays", () => {
    const doc = new Y.Doc()
    const yarray = doc.getArray<any>("arr")

    withYjsProxy<number[]>(yarray, (proxy) => {
      proxy.push(1, 2, 3)
      proxy[0] = 10
      expect(proxy.length).toBe(3)
      expect(proxy[0]).toBe(10)
    })

    expect(yarray.toArray()).toEqual([10, 2, 3])
  })

  test("errors in callback propagate and still revoke proxies", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    let capturedProxy: any

    expect(() => {
      withYjsProxy<{ x: number }>(ymap, (proxy) => {
        proxy.x = 1
        capturedProxy = proxy
        throw new Error("boom")
      })
    }).toThrow("boom")

    // Proxy should still be revoked after error
    expect(() => capturedProxy.x).toThrow("proxy that has been revoked")
  })

  test("can call withYjsProxy multiple times sequentially", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    withYjsProxy<{ a: number }>(ymap, (proxy) => {
      proxy.a = 1
    })

    withYjsProxy<{ a: number; b: number }>(ymap, (proxy) => {
      proxy.b = proxy.a + 1
    })

    expect(ymap.get("a")).toBe(1)
    expect(ymap.get("b")).toBe(2)
  })

  test("yjsWrapperToJson works inside scope", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    withYjsProxy<{ nested: { a: number; b: number[] } }>(ymap, (proxy) => {
      proxy.nested = { a: 1, b: [2, 3] }
      const json = yjsWrapperToJson(proxy.nested)
      expect(json).toEqual({ a: 1, b: [2, 3] })
    })
  })

  test("detached values (unparented Y.Map/Array) - writes work, reads require doc", () => {
    const ymap = new Y.Map()

    // Should work without a doc for writes (no transaction wrapping)
    withYjsProxy<{ x: number }>(ymap, (proxy) => {
      proxy.x = 1
      // Note: Yjs unparented types don't support reading (warns "Invalid access")
      // So we can't expect proxy.x to work here
    })

    // After attaching to a doc, we can read
    const doc = new Y.Doc()
    doc.getMap("root").set("nested", ymap)

    expect(ymap.get("x")).toBe(1)
  })

  test("deeply nested proxy revocation", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    let captured: any

    withYjsProxy<{ a: { b: { c: { d: number } } } }>(ymap, (proxy) => {
      proxy.a = { b: { c: { d: 1 } } }
      captured = proxy.a.b.c
      expect(captured.d).toBe(1)
    })

    expect(() => captured.d).toThrow("proxy that has been revoked")
  })
})
