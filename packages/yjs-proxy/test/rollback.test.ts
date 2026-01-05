import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { withYjsProxy } from "../src"

describe("rollback", () => {
  describe("map operations", () => {
    test("rolls back set and delete on error", () => {
      const doc = new Y.Doc()
      const ymap = doc.getMap("root")
      ymap.set("existing", 1)

      expect(() => {
        withYjsProxy<{ existing?: number; new?: number }>(
          ymap,
          (proxy) => {
            proxy.existing = 999
            proxy.new = 100
            delete proxy.existing
            throw new Error("test")
          },
          { rollbackOnError: true }
        )
      }).toThrow("test")

      expect(ymap.get("existing")).toBe(1)
      expect(ymap.has("new")).toBe(false)
    })

    test("rolls back nested object mutations", () => {
      const doc = new Y.Doc()
      const ymap = doc.getMap("root")

      withYjsProxy<{ nested: { a: number } }>(ymap, (p) => {
        p.nested = { a: 1 }
      })

      expect(() => {
        withYjsProxy<{ nested: { a: number; b?: number } }>(
          ymap,
          (proxy) => {
            proxy.nested.a = 999
            proxy.nested.b = 100
            throw new Error("test")
          },
          { rollbackOnError: true }
        )
      }).toThrow("test")

      const nested = ymap.get("nested") as Y.Map<any>
      expect(nested.get("a")).toBe(1)
      expect(nested.has("b")).toBe(false)
    })

    test("without rollbackOnError, changes persist", () => {
      const doc = new Y.Doc()
      const ymap = doc.getMap("root")
      ymap.set("x", 1)

      expect(() => {
        withYjsProxy<{ x: number }>(ymap, (proxy) => {
          proxy.x = 999
          throw new Error("test")
        })
      }).toThrow("test")

      expect(ymap.get("x")).toBe(999)
    })
  })

  describe("array operations", () => {
    test.each([
      ["push", (p: number[]) => p.push(4, 5)],
      ["pop", (p: number[]) => p.pop()],
      ["shift", (p: number[]) => p.shift()],
      ["unshift", (p: number[]) => p.unshift(0, -1)],
      ["splice", (p: number[]) => p.splice(1, 1, 100)],
      ["reverse", (p: number[]) => p.reverse()],
      ["sort", (p: number[]) => p.sort((a, b) => b - a)],
      ["fill", (p: number[]) => p.fill(0, 0, 2)],
      ["copyWithin", (p: number[]) => p.copyWithin(0, 2)],
      [
        "index assignment",
        (p: number[]) => {
          p[1] = 999
        },
      ],
      [
        "length truncation",
        (p: number[]) => {
          p.length = 1
        },
      ],
      [
        "length extension",
        (p: number[]) => {
          p.length = 10
        },
      ],
      [
        "delete",
        (p: number[]) => {
          delete (p as any)[1]
        },
      ],
    ])("rolls back %s on error", (_name, operation) => {
      const doc = new Y.Doc()
      const yarr = doc.getArray<number>("root")
      yarr.insert(0, [1, 2, 3])
      const original = yarr.toArray()

      expect(() => {
        withYjsProxy<number[]>(
          yarr,
          (proxy) => {
            operation(proxy)
            throw new Error("test")
          },
          { rollbackOnError: true }
        )
      }).toThrow("test")

      expect(yarr.toArray()).toEqual(original)
    })
  })

  describe("manual mode", () => {
    test("rolls back on sync and async errors", async () => {
      // Sync
      const doc1 = new Y.Doc()
      const ymap1 = doc1.getMap("root")
      ymap1.set("x", 1)

      expect(() => {
        withYjsProxy<{ x: number }>(
          ymap1,
          (proxy, ctx) => {
            ctx.transact(() => {
              proxy.x = 999
            })
            throw new Error("test")
          },
          { transactionMode: "manual", rollbackOnError: true }
        )
      }).toThrow("test")
      expect(ymap1.get("x")).toBe(1)

      // Async
      const doc2 = new Y.Doc()
      const ymap2 = doc2.getMap("root")
      ymap2.set("x", 1)

      await expect(
        withYjsProxy<{ x: number }>(
          ymap2,
          async (proxy, ctx) => {
            ctx.transact(() => {
              proxy.x = 999
            })
            await Promise.resolve()
            throw new Error("test")
          },
          { transactionMode: "manual", rollbackOnError: true }
        )
      ).rejects.toThrow("test")
      expect(ymap2.get("x")).toBe(1)
    })

    test("skips rollback when proxies invalidated", () => {
      const doc = new Y.Doc()
      const ymap = doc.getMap("root")
      ymap.set("x", 1)

      expect(() => {
        withYjsProxy<{ x: number }>(
          ymap,
          (proxy, ctx) => {
            ctx.transact(() => {
              proxy.x = 999
            })
            doc.transact(() => ymap.set("external", 1), "external")
            throw new Error("test")
          },
          { transactionMode: "manual", rollbackOnError: true }
        )
      }).toThrow("test")

      expect(ymap.get("x")).toBe(999) // NOT rolled back
    })
  })

  describe("aliases", () => {
    test("rollback propagates to aliases", () => {
      const doc = new Y.Doc()
      const ymap = doc.getMap("root")
      const shared = { x: 1 }

      withYjsProxy<{ a: typeof shared; b: typeof shared }>(ymap, (p) => {
        p.a = shared
        p.b = shared
      })

      expect(() => {
        withYjsProxy<{ a: { x: number }; b: { x: number } }>(
          ymap,
          (proxy) => {
            proxy.a.x = 999
            throw new Error("test")
          },
          { rollbackOnError: true }
        )
      }).toThrow("test")

      expect((ymap.get("a") as Y.Map<any>).get("x")).toBe(1)
      expect((ymap.get("b") as Y.Map<any>).get("x")).toBe(1)
    })
  })
})
