import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { toYjsProxy, unwrapYjs, wrapYjs } from "../src"

describe("wrapYjs (Y.Array)", () => {
  test("index assignment, length, push/pop", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<unknown[]>(yarr)

    js.push(1)
    js.push(2)
    expect(js.length).toBe(2)
    expect(js[0]).toBe(1)
    expect(js[1]).toBe(2)

    js[1] = 3
    expect(js[1]).toBe(3)

    const popped = js.pop()
    expect(popped).toBe(3)
    expect(js.length).toBe(1)
  })

  test("splice runs as a single Yjs transaction", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<unknown[]>(yarr)

    js.push(1, 2, 3)

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    js.splice(1, 1, 9, 8)
    expect(js).toEqual([1, 9, 8, 3])
    expect(txCount).toBe(1)
  })

  test("sort mutates via native semantics + commit back", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(3, 1, 2)
    const returned = js.sort((a, b) => a - b)
    expect(returned).toBe(js)
    expect(js).toEqual([1, 2, 3])
  })

  test("toSorted is non-mutating", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(3, 1, 2)
    const sorted = (js as any).toSorted((a: number, b: number) => a - b)
    expect(sorted).toEqual([1, 2, 3])
    expect(js).toEqual([3, 1, 2])
  })

  test("reusing a proxied element creates alias (sync check)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    js.push({ a: 1 })
    js.push(js[0])

    expect(js[0]).not.toBe(js[1])

    // With aliasing, modifying one DOES affect the other
    js[1].a = 2
    expect(js[0].a).toBe(2)
    expect(js[1].a).toBe(2)

    const y0 = unwrapYjs(js[0])
    const y1 = unwrapYjs(js[1])
    expect(y0).toBeInstanceOf(Y.Map)
    expect(y1).toBeInstanceOf(Y.Map)
    expect(y0).not.toBe(y1)
  })

  test("shift/unshift", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(1, 2)
    expect(js.shift()).toBe(1)
    expect(js).toEqual([2])

    expect(js.unshift(0)).toBe(2)
    expect(js).toEqual([0, 2])
  })

  test("fill", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(1, 2, 3, 4)
    js.fill(0, 1, 3)
    expect(js).toEqual([1, 0, 0, 4])
  })

  test("copyWithin", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(1, 2, 3, 4, 5)
    js.copyWithin(0, 3, 4)
    expect(js).toEqual([4, 2, 3, 4, 5])
  })

  test("reverse", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(1, 2, 3)
    js.reverse()
    expect(js).toEqual([3, 2, 1])
  })

  test("length truncation and expansion", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    js.push(1, 2, 3)
    js.length = 1
    expect(js).toEqual([1])
    expect(yarr.length).toBe(1)

    js.length = 3
    expect(js.length).toBe(3)
    expect(js[1]).toBe(null)
    expect(js[2]).toBe(null)

    // No-op length change should not trigger a transaction
    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })
    js.length = 3
    expect(txCount).toBe(0)

    js.length = 0
    expect(js.length).toBe(0)
    expect(yarr.length).toBe(0)
  })

  test("pop and shift on empty array", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    expect(js.pop()).toBeUndefined()
    expect(js.shift()).toBeUndefined()
  })

  test("delete on detached array", () => {
    const js = toYjsProxy<any[]>([1, 2])
    delete js[0]
    expect(js[0]).toBeNull()

    delete js[10] // out of bounds
    expect(js.length).toBe(2)
  })

  test("no-op index assignment and deletion", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    js.push(1, null)

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    // No-op assignment
    js[0] = 1
    expect(txCount).toBe(0)

    // No-op deletion (already null)
    delete js[1]
    expect(txCount).toBe(0)

    // No-op deletion (out of bounds)
    delete js[100]
    expect(txCount).toBe(0)

    // No-op assignment of same object proxy
    js.push({ a: 1 })
    txCount = 0
    // biome-ignore lint/correctness/noSelfAssign: intentional test
    js[2] = js[2]
    expect(txCount).toBe(0)
  })

  test("deleteProperty", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    js.push(1, 2, 3)
    delete js[1]
    expect(js[1]).toBe(null)
    expect(js.length).toBe(3)
    expect(yarr.get(1)).toBe(null)
  })

  test("deleteProperty in detached mode", () => {
    const js = toYjsProxy([1, 2, 3])
    delete js[1]
    expect(js[1]).toBe(null)
    expect(js.length).toBe(3)
  })

  test("iterator and ownKeys", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(10, 20)
    expect(Object.keys(js)).toEqual(["0", "1"])

    const results: number[] = []
    for (const val of js) {
      results.push(val)
    }
    expect(results).toEqual([10, 20])
    expect([...js]).toEqual([10, 20])
    expect(Array.from(js)).toEqual([10, 20])

    expect(Object.values(js)).toEqual([10, 20])
    expect(Object.entries(js)).toEqual([
      ["0", 10],
      ["1", 20],
    ])
  })

  test("instanceof and Array.isArray", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    expect(Array.isArray(js)).toBe(true)
    // biome-ignore lint/suspicious/useIsArray: intended test
    expect(js instanceof Array).toBe(true)
  })

  test("JSON.stringify", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    js.push(1, { b: 2 })
    expect(JSON.stringify(js)).toBe('[1,{"b":2}]')
  })

  test("ES2023 methods (toReversed, toSpliced, with)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    js.push(1, 2, 3)

    expect((js as any).toReversed()).toEqual([3, 2, 1])
    expect(js).toEqual([1, 2, 3])

    expect((js as any).toSpliced(1, 1, 9)).toEqual([1, 9, 3])
    expect(js).toEqual([1, 2, 3])

    expect((js as any).with(1, 9)).toEqual([1, 9, 3])
    expect(js).toEqual([1, 2, 3])
  })

  test("sparse array behavior", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js[10] = 123
    expect(js.length).toBe(11)
    expect(js[5]).toBe(null)
    expect(5 in js).toBe(true) // Current behavior: dense simulation
    expect(Object.keys(js)).toContain("5") // Current behavior: dense simulation
  })

  test("setting undefined on Y.Array crashes (Yjs behavior)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    expect(() => {
      js[0] = undefined
    }).toThrow("Cannot read properties of undefined (reading 'constructor')")
  })

  test("map, filter, reduce, find, some, every", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(1, 2, 3, 4)

    expect(js.map((x) => x * 2)).toEqual([2, 4, 6, 8])
    expect(js.filter((x) => x % 2 === 0)).toEqual([2, 4])
    expect(js.reduce((acc, x) => acc + x, 0)).toBe(10)
    expect(js.find((x) => x > 2)).toBe(3)
    expect(js.some((x) => x === 3)).toBe(true)
    expect(js.every((x) => x > 0)).toBe(true)
  })

  test("keys(), values(), entries() methods", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(10, 20)

    expect([...js.keys()]).toEqual([0, 1])
    expect([...js.values()]).toEqual([10, 20])
    expect([...js.entries()]).toEqual([
      [0, 10],
      [1, 20],
    ])
  })

  test("nested arrays and objects", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    // Initial push with nested structures
    js.push([1, 2], { a: 3 })

    expect(js[0]).toEqual([1, 2])
    expect(js[1]).toEqual({ a: 3 })

    // Modify nested array
    js[0].push(3)
    expect(js[0]).toEqual([1, 2, 3])
    expect(yarr.get(0)).toBeInstanceOf(Y.Array)
    expect((yarr.get(0) as Y.Array<any>).toJSON()).toEqual([1, 2, 3])

    // Modify nested object
    js[1].b = 4
    expect(js[1]).toEqual({ a: 3, b: 4 })
    expect(yarr.get(1)).toBeInstanceOf(Y.Map)
    expect((yarr.get(1) as Y.Map<any>).toJSON()).toEqual({ a: 3, b: 4 })

    // Deeply nested
    js.push({ nested: [9] })
    js[2].nested.push(8)
    expect(js[2].nested).toEqual([9, 8])

    const yMap = yarr.get(2) as Y.Map<any>
    const yNestedArr = yMap.get("nested") as Y.Array<any>
    expect(yNestedArr.toJSON()).toEqual([9, 8])

    // Replacement
    js[0] = { new: "object" }
    expect(js[0]).toEqual({ new: "object" })
    expect(yarr.get(0)).toBeInstanceOf(Y.Map)

    // Deletion
    js.splice(1, 1)
    expect(js.length).toBe(2)
    expect(js[1]).toEqual({ nested: [9, 8] })
  })

  test("indexOf, lastIndexOf, includes", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(1, 2, 3, 2, 1)

    expect(js.indexOf(2)).toBe(1)
    expect(js.lastIndexOf(2)).toBe(3)
    expect(js.includes(3)).toBe(true)
    expect(js.includes(5)).toBe(false)
  })

  test("at, slice, concat", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(1, 2, 3)

    expect(js.at(-1)).toBe(3)
    expect(js.slice(1)).toEqual([2, 3])
    expect(js.concat([4, 5])).toEqual([1, 2, 3, 4, 5])
    // concat should not mutate
    expect(js).toEqual([1, 2, 3])
  })

  test("join", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<(number | null)[]>(yarr)

    js.push(1, 2, 3)
    expect(js.join("-")).toBe("1-2-3")

    js.push(null)
    expect(js.join(",")).toBe("1,2,3,")
  })

  test("manual transaction grouping", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    doc.transact(() => {
      js.push(1)
      js.push(2)
      js[0] = 9
    })

    expect(txCount).toBe(1)
    expect(js).toEqual([9, 2])
  })

  test("non-index property assignment throws", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any>(yarr)

    expect(() => {
      js.foo = "bar"
    }).toThrow()
    expect(js.foo).toBeUndefined()

    const sym = Symbol("test")
    expect(() => {
      js[sym as any] = 1
    }).toThrow()
  })

  test("indirect method calls (apply/call)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    Array.prototype.push.call(js, 1, 2)
    expect(js).toEqual([1, 2])

    Array.prototype.splice.call(js, 1, 1, 9)
    expect(js).toEqual([1, 9])

    const sliced = Array.prototype.slice.call(js, 0, 1)
    expect(sliced).toEqual([1])
  })

  test("circular reference detection", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    const obj: any = { a: 1 }
    obj.self = obj

    expect(() => {
      js.push(obj)
    }).toThrow("Cyclic objects are not supported")
  })

  test("wrapYjs returns the same proxy for the same Y.js value", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const p1 = wrapYjs(yarr)
    const p2 = wrapYjs(yarr)
    expect(p1).toBe(p2)
  })

  test("assigning a proxy to another proxy creates alias for the underlying Y.js value", () => {
    const doc = new Y.Doc()
    const yarr1 = doc.getArray("a1")
    const yarr2 = doc.getArray("a2")
    const p1 = wrapYjs<any[]>(yarr1)
    const p2 = wrapYjs<any[]>(yarr2)

    p2.push(1)
    p1.push(p2)

    expect(p1[0]).not.toBe(p2)
    expect(p1[0]).toEqual([1])

    // With aliasing, modifying one DOES affect the other
    p1[0].push(2)
    expect(p1[0]).toEqual([1, 2])
    expect(p2).toEqual([1, 2])
  })

  test("in operator for indices, length, and methods", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(10)

    expect(0 in js).toBe(true)
    expect(1 in js).toBe(false)
    expect("length" in js).toBe(true)
    expect("push" in js).toBe(true)
    expect("map" in js).toBe(true)
    expect("nonExistent" in js).toBe(false)
  })

  test("overlapping copyWithin", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(1, 2, 3, 4, 5)
    // Copy [1, 2, 3] to index 1 -> [1, 1, 2, 3, 5]
    js.copyWithin(1, 0, 3)
    expect(js).toEqual([1, 1, 2, 3, 5])
  })

  test("includes/indexOf with its own elements (proxies)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    const item = { a: 1 }
    js.push(item)

    const proxyItem = js[0]
    expect(js.includes(proxyItem)).toBe(true)
    expect(js.indexOf(proxyItem)).toBe(0)
  })

  test("concat with other proxies", () => {
    const doc = new Y.Doc()
    const yarr1 = doc.getArray("a1")
    const yarr2 = doc.getArray("a2")
    const p1 = wrapYjs<number[]>(yarr1)
    const p2 = wrapYjs<number[]>(yarr2)

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
    const js = wrapYjs<number[]>(yarr)

    js.push(1, 2, 3, 2)

    expect(js.reduceRight((acc, x) => String(acc) + String(x), "")).toBe("2321")
    expect((js as any).findLast((x: number) => x === 2)).toBe(2)
    expect((js as any).findLastIndex((x: number) => x === 2)).toBe(3)
  })

  test("getPrototypeOf and setPrototypeOf", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    expect(Object.getPrototypeOf(js)).toBe(Array.prototype)
    expect(() => Object.setPrototypeOf(js, {})).toThrow()
  })

  test("Reflect.ownKeys includes length", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(10)
    const keys = Reflect.ownKeys(js)
    expect(keys).toContain("0")
    expect(keys).toContain("length")
  })

  test("nested proxy identity (cache check)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    js.push({ a: 1 })
    const p1 = js[0]
    const p2 = js[0]
    expect(p1).toBe(p2)
  })

  test("Object.getOwnPropertyDescriptor for length and indices", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)

    js.push(10)

    const lengthDesc = Object.getOwnPropertyDescriptor(js, "length")
    expect(lengthDesc).toEqual({
      configurable: false,
      enumerable: false,
      writable: true,
      value: 1,
    })

    const indexDesc = Object.getOwnPropertyDescriptor(js, "0")
    expect(indexDesc).toEqual({
      configurable: true,
      enumerable: true,
      writable: true,
      value: 10,
    })

    const outDesc = Object.getOwnPropertyDescriptor(js, "1")
    expect(outDesc).toBeUndefined()
  })

  test("Object.defineProperty validation", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    // length must be non-configurable and non-enumerable
    expect(() => {
      Object.defineProperty(js, "length", {
        value: 10,
        configurable: true,
      })
    }).toThrow()

    expect(() => {
      Object.defineProperty(js, "length", {
        value: 10,
        enumerable: true,
      })
    }).toThrow()

    expect(() => {
      Object.defineProperty(js, "length", {
        value: 10,
        writable: false,
      })
    }).toThrow()

    // This should work (matching defaults for length)
    Object.defineProperty(js, "length", {
      value: 5,
      configurable: false,
      enumerable: false,
      writable: true,
    })
    expect(js.length).toBe(5)

    // indices must be configurable, enumerable and writable
    expect(() => {
      Object.defineProperty(js, "0", {
        value: 1,
        configurable: false,
      })
    }).toThrow()

    expect(() => {
      Object.defineProperty(js, "0", {
        value: 1,
        enumerable: false,
      })
    }).toThrow()

    expect(() => {
      Object.defineProperty(js, "0", {
        value: 1,
        writable: false,
      })
    }).toThrow()

    // This should work
    Object.defineProperty(js, "0", {
      value: 100,
      configurable: true,
      enumerable: true,
      writable: true,
    })
    expect(js[0]).toBe(100)
  })

  test("Object.defineProperty with non-value descriptors", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    // We only support value-based definitions for indices
    expect(() => {
      Object.defineProperty(js, "0", {
        get() {
          return 1
        },
      })
    }).toThrow() // Should return false in trap, which throws in strict mode
  })

  test("Object.preventExtensions and Object.seal throw", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any>(yarr)

    expect(() => Object.preventExtensions(js)).toThrow()
    expect(() => Object.seal(js)).toThrow()
  })

  test("BigInt support (currently limited by Yjs)", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    const bigIntVal = BigInt("9007199254740991")

    // Y.Array.insert does not support BigInt primitives in Yjs v13
    // apparently it only works in objects for now
    expect(() => {
      js.push(bigIntVal)
    }).toThrow("Unexpected content type in insert operation")
  })

  test("Uint8Array support", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any[]>(yarr)

    const uint8ArrayVal = new Uint8Array([1, 2, 3])
    js.push(uint8ArrayVal)

    expect(js[0]).toBeInstanceOf(Uint8Array)
    expect(Array.from(js[0])).toEqual([1, 2, 3])
    expect(yarr.get(0)).toBeInstanceOf(Uint8Array)
  })

  test("set length to invalid value throws RangeError", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<number[]>(yarr)
    expect(() => {
      js.length = -1
    }).toThrow(RangeError)
    expect(() => {
      js.length = Number.NaN
    }).toThrow(RangeError)
  })

  test("detached mode: iterator, non-index get/set, deleteProperty", () => {
    const arr = toYjsProxy([1, 2, 3]) as any

    // iterator
    const values = []
    for (const v of arr) {
      values.push(v)
    }
    expect(values).toEqual([1, 2, 3])

    // non-index get/set
    expect(() => {
      arr.someProp = "hello"
    }).toThrow("Arrays do not support custom properties")
    expect(arr.someProp).toBeUndefined()
    expect("someProp" in arr).toBe(false)
    expect(1 in arr).toBe(true)
    expect(5 in arr).toBe(false)

    // deleteProperty
    expect(delete arr.someProp).toBe(true)
  })

  test("defineProperty with getter/setter throws", () => {
    const arr = toYjsProxy([1, 2, 3])
    expect(() => {
      Object.defineProperty(arr, "0", {
        get() {
          return 1
        },
      })
    }).toThrow()
  })

  test("getOwnPropertyDescriptor for non-existent property", () => {
    const arr = toYjsProxy([1, 2, 3])
    expect(Object.getOwnPropertyDescriptor(arr, "someProp")).toBeUndefined()
  })

  test("defineProperty for non-index property returns false", () => {
    const arr = toYjsProxy([1, 2, 3])
    expect(() => {
      Object.defineProperty(arr, "someProp", { value: 1 })
    }).toThrow() // In strict mode, returning false from defineProperty trap throws TypeError
  })

  test("attached mode: deleteProperty on non-index returns true", () => {
    const doc = new Y.Doc()
    const yarr = doc.getArray("a")
    const js = wrapYjs<any>(yarr)
    expect(delete js.someProp).toBe(true)
  })
})
