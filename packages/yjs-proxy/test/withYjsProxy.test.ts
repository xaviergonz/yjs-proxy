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

describe("withYjsProxy manual mode", () => {
  test("works with sync callback", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    withYjsProxy<{ count: number }>(
      ymap,
      (proxy, ctx) => {
        proxy.count = 1
        expect(proxy.count).toBe(1)
        expect(ctx.isProxyInvalidated()).toBe(false)
      },
      { transactionMode: "manual" }
    )

    expect(ymap.get("count")).toBe(1)
  })

  test("works with async callback", async () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    await withYjsProxy<{ count: number }>(
      ymap,
      async (proxy, ctx) => {
        proxy.count = 1
        await Promise.resolve()
        proxy.count = 2
        expect(ctx.isProxyInvalidated()).toBe(false)
      },
      { transactionMode: "manual" }
    )

    expect(ymap.get("count")).toBe(2)
  })

  test("transact batches changes", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    const events: string[] = []
    doc.on("update", () => events.push("update"))

    withYjsProxy<{ a: number; b: number; c: number }>(
      ymap,
      (proxy, ctx) => {
        ctx.transact(() => {
          proxy.a = 1
          proxy.b = 2
          proxy.c = 3
        })
      },
      { transactionMode: "manual" }
    )

    // All changes batched into one transaction
    expect(events.length).toBe(1)
  })

  test("external change invalidates proxies", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    let capturedProxy: any
    let invalidated = false

    withYjsProxy<{ count: number }>(
      ymap,
      (proxy, ctx) => {
        proxy.count = 1
        capturedProxy = proxy

        // Simulate external change
        doc.transact(() => {
          ymap.set("external", 999)
        }, "external-origin")

        invalidated = ctx.isProxyInvalidated()
      },
      { transactionMode: "manual" }
    )

    expect(invalidated).toBe(true)
    expect(() => capturedProxy.count).toThrow("proxy that has been revoked")
  })

  test("isProxyInvalidated returns correct state", async () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    let beforeExternal = false
    let afterExternal = false

    await withYjsProxy<{ count: number }>(
      ymap,
      async (proxy, ctx) => {
        proxy.count = 1
        beforeExternal = ctx.isProxyInvalidated()

        // External change
        doc.transact(() => ymap.set("x", 1), "external")

        afterExternal = ctx.isProxyInvalidated()
      },
      { transactionMode: "manual" }
    )

    expect(beforeExternal).toBe(false)
    expect(afterExternal).toBe(true)
  })

  test("custom origin is used", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")
    const customOrigin = "my-custom-origin"

    let observedOrigin: unknown

    doc.on("update", (_update, origin) => {
      observedOrigin = origin
    })

    withYjsProxy<{ count: number }>(
      ymap,
      (proxy) => {
        proxy.count = 1
      },
      { transactionMode: "manual", origin: customOrigin }
    )

    expect(observedOrigin).toBe(customOrigin)
  })

  test("auto mode also uses custom origin", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")
    const customOrigin = "my-auto-origin"

    let observedOrigin: unknown

    doc.on("update", (_update, origin) => {
      observedOrigin = origin
    })

    withYjsProxy<{ count: number }>(
      ymap,
      (proxy) => {
        proxy.count = 1
      },
      { origin: customOrigin }
    )

    expect(observedOrigin).toBe(customOrigin)
  })

  test("changes with our origin do not invalidate", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    let invalidated = false

    withYjsProxy<{ a: number; b: number }>(
      ymap,
      (proxy, ctx) => {
        proxy.a = 1
        // This uses OUR origin via transact
        ctx.transact(() => {
          proxy.b = 2
        })
        invalidated = ctx.isProxyInvalidated()
      },
      { transactionMode: "manual" }
    )

    expect(invalidated).toBe(false)
    expect(ymap.get("a")).toBe(1)
    expect(ymap.get("b")).toBe(2)
  })

  test("cleanup on async error", async () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("root")

    let capturedProxy: any

    await expect(
      withYjsProxy<{ count: number }>(
        ymap,
        async (proxy) => {
          proxy.count = 1
          capturedProxy = proxy
          throw new Error("test error")
        },
        { transactionMode: "manual" }
      )
    ).rejects.toThrow("test error")

    // Proxy should be revoked after error
    expect(() => capturedProxy.count).toThrow("proxy that has been revoked")
  })

  test("multiple values from different docs - per-doc invalidation", () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    const ymap1 = doc1.getMap("m1")
    const ymap2 = doc2.getMap("m2")

    let invalidated = false

    withYjsProxy<[{ a: number }, { b: number }]>(
      [ymap1, ymap2],
      ([p1, p2], ctx) => {
        p1.a = 1
        p2.b = 2

        // External change on doc1 only
        doc1.transact(() => ymap1.set("x", 1), "external")

        invalidated = ctx.isProxyInvalidated()
      },
      { transactionMode: "manual" }
    )

    expect(invalidated).toBe(true)
  })

  test("transact wraps all docs in transactions", () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    const ymap1a = doc1.getMap("m1a")
    const ymap1b = doc1.getMap("m1b")
    const ymap2a = doc2.getMap("m2a")
    const ymap2b = doc2.getMap("m2b")

    const doc1Updates: string[] = []
    const doc2Updates: string[] = []
    doc1.on("update", () => doc1Updates.push("update"))
    doc2.on("update", () => doc2Updates.push("update"))

    withYjsProxy<[{ a: number }, { b: number }, { c: number }, { d: number }]>(
      [ymap1a, ymap1b, ymap2a, ymap2b],
      ([p1a, p1b, p2a, p2b], ctx) => {
        ctx.transact(() => {
          p1a.a = 1
          p1b.b = 2
          p2a.c = 3
          p2b.d = 4
        })
      },
      { transactionMode: "manual" }
    )

    // Each doc should have exactly one update (changes batched)
    expect(doc1Updates.length).toBe(1)
    expect(doc2Updates.length).toBe(1)

    // All values should be set
    expect(ymap1a.get("a")).toBe(1)
    expect(ymap1b.get("b")).toBe(2)
    expect(ymap2a.get("c")).toBe(3)
    expect(ymap2b.get("d")).toBe(4)
  })
})
