import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { pojoToYjs, yjsAsPojo } from "../src/index"

describe("yjsAsPojo (Y.Array)", () => {
  test("index assignment, length, push/pop", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<unknown[]>(yarr)

    pojo.push(1)
    pojo.push(2)
    expect(pojo.length).toBe(2)
    expect(pojo[0]).toBe(1)
    expect(pojo[1]).toBe(2)

    pojo[1] = 3
    expect(pojo[1]).toBe(3)

    const popped = pojo.pop()
    expect(popped).toBe(3)
    expect(pojo.length).toBe(1)
  })

  test("splice runs as a single Yjs transaction", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<unknown[]>(yarr)

    pojo.push(1, 2, 3)

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    pojo.splice(1, 1, 9, 8)
    expect(pojo).toEqual([1, 9, 8, 3])
    expect(txCount).toBe(1)
  })

  test("sort mutates via native semantics + commit back", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(3, 1, 2)
    const returned = pojo.sort((a, b) => a - b)
    expect(returned).toBe(pojo)
    expect(pojo).toEqual([1, 2, 3])
  })

  test("toSorted is non-mutating", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(3, 1, 2)
    const sorted = (pojo as any).toSorted((a: number, b: number) => a - b)
    expect(sorted).toEqual([1, 2, 3])
    expect(pojo).toEqual([3, 1, 2])
  })

  test("reusing a proxied element clones (independence check)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    pojo.push({ a: 1 })
    pojo.push(pojo[0])

    expect(pojo[0]).not.toBe(pojo[1])

    // Modifying one should not affect the other
    pojo[1].a = 2
    expect(pojo[0].a).toBe(1)
    expect(pojo[1].a).toBe(2)

    const y0 = pojoToYjs(pojo[0])
    const y1 = pojoToYjs(pojo[1])
    expect(y0).toBeInstanceOf(Y.Map)
    expect(y1).toBeInstanceOf(Y.Map)
    expect(y0).not.toBe(y1)
  })

  test("shift/unshift", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(1, 2)
    expect(pojo.shift()).toBe(1)
    expect(pojo).toEqual([2])

    expect(pojo.unshift(0)).toBe(2)
    expect(pojo).toEqual([0, 2])
  })

  test("fill", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(1, 2, 3, 4)
    pojo.fill(0, 1, 3)
    expect(pojo).toEqual([1, 0, 0, 4])
  })

  test("copyWithin", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(1, 2, 3, 4, 5)
    pojo.copyWithin(0, 3, 4)
    expect(pojo).toEqual([4, 2, 3, 4, 5])
  })

  test("reverse", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(1, 2, 3)
    pojo.reverse()
    expect(pojo).toEqual([3, 2, 1])
  })

  test("length truncation and expansion", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    pojo.push(1, 2, 3)
    pojo.length = 1
    expect(pojo).toEqual([1])
    expect(yarr.length).toBe(1)

    pojo.length = 3
    expect(pojo.length).toBe(3)
    expect(pojo[1]).toBe(null)
    expect(pojo[2]).toBe(null)

    // No-op length change should not trigger a transaction
    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })
    pojo.length = 3
    expect(txCount).toBe(0)

    pojo.length = 0
    expect(pojo.length).toBe(0)
    expect(yarr.length).toBe(0)
  })

  test("no-op index assignment and deletion", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    pojo.push(1, null)

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    // No-op assignment
    pojo[0] = 1
    expect(txCount).toBe(0)

    // No-op deletion (already null)
    delete pojo[1]
    expect(txCount).toBe(0)

    // No-op deletion (out of bounds)
    delete pojo[100]
    expect(txCount).toBe(0)

    // No-op assignment of same object proxy
    pojo.push({ a: 1 })
    txCount = 0
    // biome-ignore lint/correctness/noSelfAssign: intentional test
    pojo[2] = pojo[2]
    expect(txCount).toBe(0)
  })

  test("deleteProperty", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    pojo.push(1, 2, 3)
    delete pojo[1]
    expect(pojo[1]).toBe(null)
    expect(pojo.length).toBe(3)
    expect(yarr.get(1)).toBe(null)
  })

  test("iterator and ownKeys", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(10, 20)
    expect(Object.keys(pojo)).toEqual(["0", "1"])

    const results: number[] = []
    for (const val of pojo) {
      results.push(val)
    }
    expect(results).toEqual([10, 20])
    expect([...pojo]).toEqual([10, 20])
    expect(Array.from(pojo)).toEqual([10, 20])

    expect(Object.values(pojo)).toEqual([10, 20])
    expect(Object.entries(pojo)).toEqual([
      ["0", 10],
      ["1", 20],
    ])
  })

  test("instanceof and Array.isArray", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    expect(Array.isArray(pojo)).toBe(true)
    // biome-ignore lint/suspicious/useIsArray: intended test
    expect(pojo instanceof Array).toBe(true)
  })

  test("JSON.stringify", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    pojo.push(1, { b: 2 })
    expect(JSON.stringify(pojo)).toBe('[1,{"b":2}]')
  })

  test("ES2023 methods (toReversed, toSpliced, with)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    pojo.push(1, 2, 3)

    expect((pojo as any).toReversed()).toEqual([3, 2, 1])
    expect(pojo).toEqual([1, 2, 3])

    expect((pojo as any).toSpliced(1, 1, 9)).toEqual([1, 9, 3])
    expect(pojo).toEqual([1, 2, 3])

    expect((pojo as any).with(1, 9)).toEqual([1, 9, 3])
    expect(pojo).toEqual([1, 2, 3])
  })

  test("sparse array behavior", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo[10] = 123
    expect(pojo.length).toBe(11)
    expect(pojo[5]).toBe(null)
    expect(5 in pojo).toBe(true) // Current behavior: dense simulation
    expect(Object.keys(pojo)).toContain("5") // Current behavior: dense simulation
  })

  test("setting undefined on Y.Array crashes (Yjs behavior)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    expect(() => {
      pojo[0] = undefined
    }).toThrow("Cannot read properties of undefined (reading 'constructor')")
  })

  test("map, filter, reduce, find, some, every", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(1, 2, 3, 4)

    expect(pojo.map((x) => x * 2)).toEqual([2, 4, 6, 8])
    expect(pojo.filter((x) => x % 2 === 0)).toEqual([2, 4])
    expect(pojo.reduce((acc, x) => acc + x, 0)).toBe(10)
    expect(pojo.find((x) => x > 2)).toBe(3)
    expect(pojo.some((x) => x === 3)).toBe(true)
    expect(pojo.every((x) => x > 0)).toBe(true)
  })

  test("keys(), values(), entries() methods", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(10, 20)

    expect([...pojo.keys()]).toEqual([0, 1])
    expect([...pojo.values()]).toEqual([10, 20])
    expect([...pojo.entries()]).toEqual([
      [0, 10],
      [1, 20],
    ])
  })

  test("nested arrays and objects", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    // Initial push with nested structures
    pojo.push([1, 2], { a: 3 })

    expect(pojo[0]).toEqual([1, 2])
    expect(pojo[1]).toEqual({ a: 3 })

    // Modify nested array
    pojo[0].push(3)
    expect(pojo[0]).toEqual([1, 2, 3])
    expect(yarr.get(0)).toBeInstanceOf(Y.Array)
    expect((yarr.get(0) as Y.Array<any>).toJSON()).toEqual([1, 2, 3])

    // Modify nested object
    pojo[1].b = 4
    expect(pojo[1]).toEqual({ a: 3, b: 4 })
    expect(yarr.get(1)).toBeInstanceOf(Y.Map)
    expect((yarr.get(1) as Y.Map<any>).toJSON()).toEqual({ a: 3, b: 4 })

    // Deeply nested
    pojo.push({ nested: [9] })
    pojo[2].nested.push(8)
    expect(pojo[2].nested).toEqual([9, 8])

    const yMap = yarr.get(2) as Y.Map<any>
    const yNestedArr = yMap.get("nested") as Y.Array<any>
    expect(yNestedArr.toJSON()).toEqual([9, 8])

    // Replacement
    pojo[0] = { new: "object" }
    expect(pojo[0]).toEqual({ new: "object" })
    expect(yarr.get(0)).toBeInstanceOf(Y.Map)

    // Deletion
    pojo.splice(1, 1)
    expect(pojo.length).toBe(2)
    expect(pojo[1]).toEqual({ nested: [9, 8] })
  })

  test("indexOf, lastIndexOf, includes", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(1, 2, 3, 2, 1)

    expect(pojo.indexOf(2)).toBe(1)
    expect(pojo.lastIndexOf(2)).toBe(3)
    expect(pojo.includes(3)).toBe(true)
    expect(pojo.includes(5)).toBe(false)
  })

  test("at, slice, concat", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(1, 2, 3)

    expect(pojo.at(-1)).toBe(3)
    expect(pojo.slice(1)).toEqual([2, 3])
    expect(pojo.concat([4, 5])).toEqual([1, 2, 3, 4, 5])
    // concat should not mutate
    expect(pojo).toEqual([1, 2, 3])
  })

  test("join", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<(number | null)[]>(yarr)

    pojo.push(1, 2, 3)
    expect(pojo.join("-")).toBe("1-2-3")

    pojo.push(null)
    expect(pojo.join(",")).toBe("1,2,3,")
  })

  test("manual transaction grouping", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    doc.transact(() => {
      pojo.push(1)
      pojo.push(2)
      pojo[0] = 9
    })

    expect(txCount).toBe(1)
    expect(pojo).toEqual([9, 2])
  })

  test("non-index property assignment throws", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any>(yarr)

    expect(() => {
      pojo.foo = "bar"
    }).toThrow()
    expect(pojo.foo).toBeUndefined()

    const sym = Symbol("test")
    expect(() => {
      pojo[sym as any] = 1
    }).toThrow()
  })

  test("indirect method calls (apply/call)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    Array.prototype.push.call(pojo, 1, 2)
    expect(pojo).toEqual([1, 2])

    Array.prototype.splice.call(pojo, 1, 1, 9)
    expect(pojo).toEqual([1, 9])

    const sliced = Array.prototype.slice.call(pojo, 0, 1)
    expect(sliced).toEqual([1])
  })

  test("circular reference detection", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    const obj: any = { a: 1 }
    obj.self = obj

    expect(() => {
      pojo.push(obj)
    }).toThrow("Cyclic POJOs are not supported")
  })

  test("yjsAsPojo returns the same proxy for the same Yjs type", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const p1 = yjsAsPojo(yarr)
    const p2 = yjsAsPojo(yarr)
    expect(p1).toBe(p2)
  })

  test("assigning a proxy to another proxy clones the underlying Yjs type", () => {
    const doc = new Y.Doc()
    const yarr1 = doc.getArray("a1")
    const yarr2 = doc.getArray("a2")
    const p1 = yjsAsPojo<any[]>(yarr1)
    const p2 = yjsAsPojo<any[]>(yarr2)

    p2.push(1)
    p1.push(p2)

    expect(p1[0]).not.toBe(p2)
    expect(p1[0]).toEqual([1])

    // Independence check
    p1[0].push(2)
    expect(p1[0]).toEqual([1, 2])
    expect(p2).toEqual([1])
  })

  test("in operator for indices, length, and methods", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(10)

    expect(0 in pojo).toBe(true)
    expect(1 in pojo).toBe(false)
    expect("length" in pojo).toBe(true)
    expect("push" in pojo).toBe(true)
    expect("map" in pojo).toBe(true)
    expect("nonExistent" in pojo).toBe(false)
  })

  test("overlapping copyWithin", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(1, 2, 3, 4, 5)
    // Copy [1, 2, 3] to index 1 -> [1, 1, 2, 3, 5]
    pojo.copyWithin(1, 0, 3)
    expect(pojo).toEqual([1, 1, 2, 3, 5])
  })

  test("includes/indexOf with its own elements (proxies)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    const item = { a: 1 }
    pojo.push(item)

    const proxyItem = pojo[0]
    expect(pojo.includes(proxyItem)).toBe(true)
    expect(pojo.indexOf(proxyItem)).toBe(0)
  })

  test("concat with other proxies", () => {
    const doc = new Y.Doc()
    const yarr1 = doc.getArray("a1")
    const yarr2 = doc.getArray("a2")
    const p1 = yjsAsPojo<number[]>(yarr1)
    const p2 = yjsAsPojo<number[]>(yarr2)

    p1.push(1)
    p2.push(2)

    const combined = p1.concat(p2)
    expect(combined).toEqual([1, 2])
    expect(Array.isArray(combined)).toBe(true)
    expect(combined).not.toBe(p1)
    expect(combined).not.toBe(p2)
  })

  test("reduceRight, findLast, findLastIndex", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(1, 2, 3, 2)

    expect(pojo.reduceRight((acc, x) => String(acc) + String(x), "")).toBe("2321")
    expect((pojo as any).findLast((x: number) => x === 2)).toBe(2)
    expect((pojo as any).findLastIndex((x: number) => x === 2)).toBe(3)
  })

  test("getPrototypeOf and setPrototypeOf", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    expect(Object.getPrototypeOf(pojo)).toBe(Array.prototype)
    expect(() => Object.setPrototypeOf(pojo, {})).toThrow()
  })

  test("Reflect.ownKeys includes length", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(10)
    const keys = Reflect.ownKeys(pojo)
    expect(keys).toContain("0")
    expect(keys).toContain("length")
  })

  test("nested proxy identity (cache check)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    pojo.push({ a: 1 })
    const p1 = pojo[0]
    const p2 = pojo[0]
    expect(p1).toBe(p2)
  })

  test("Object.getOwnPropertyDescriptor for length and indices", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<number[]>(yarr)

    pojo.push(10)

    const lengthDesc = Object.getOwnPropertyDescriptor(pojo, "length")
    expect(lengthDesc).toEqual({
      configurable: false,
      enumerable: false,
      writable: true,
      value: 1,
    })

    const indexDesc = Object.getOwnPropertyDescriptor(pojo, "0")
    expect(indexDesc).toEqual({
      configurable: true,
      enumerable: true,
      writable: true,
      value: 10,
    })

    const outDesc = Object.getOwnPropertyDescriptor(pojo, "1")
    expect(outDesc).toBeUndefined()
  })

  test("Object.defineProperty with non-value descriptors", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    // We only support value-based definitions for indices
    expect(() => {
      Object.defineProperty(pojo, "0", {
        get() {
          return 1
        },
      })
    }).toThrow() // Should return false in trap, which throws in strict mode
  })

  test("Object.preventExtensions and Object.seal throw", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any>(yarr)

    expect(() => Object.preventExtensions(pojo)).toThrow()
    expect(() => Object.seal(pojo)).toThrow()
  })

  test("BigInt support (currently limited by Yjs)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    const bigIntVal = BigInt("9007199254740991")

    // Y.Array.insert does not support BigInt primitives in Yjs v13
    // apparently it only works in objects for now
    expect(() => {
      pojo.push(bigIntVal)
    }).toThrow("Unexpected content type in insert operation")
  })

  test("Uint8Array support", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any[]>(yarr)

    const uint8ArrayVal = new Uint8Array([1, 2, 3])
    pojo.push(uint8ArrayVal)

    expect(pojo[0]).toBeInstanceOf(Uint8Array)
    expect(Array.from(pojo[0])).toEqual([1, 2, 3])
    expect(yarr.get(0)).toBeInstanceOf(Uint8Array)
  })
})
