import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { pojoToYjs, yjsAsPojo } from "../src/index"

describe("yjsAsPojo (Y.Map)", () => {
  test("basic CRUD operations", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    // Set and Get
    pojo.a = 1
    pojo.b = "x"
    expect(pojo.a).toBe(1)
    expect(pojo.b).toBe("x")

    // in operator
    expect("a" in pojo).toBe(true)
    expect("c" in pojo).toBe(false)

    // Delete
    delete pojo.a
    expect("a" in pojo).toBe(false)
    expect(ymap.has("a")).toBe(false)

    // Object.assign
    Object.assign(pojo, { c: 3, d: 4 })
    expect(pojo.c).toBe(3)
    expect(pojo.d).toBe(4)
  })

  test("nested structures (objects and arrays)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    // Nested object
    pojo.obj = { a: 1 }
    expect(pojo.obj.a).toBe(1)
    expect(pojoToYjs(pojo.obj)).toBeInstanceOf(Y.Map)

    // Nested array
    pojo.list = [1, 2]
    expect(pojo.list).toEqual([1, 2])
    expect(pojoToYjs(pojo.list)).toBeInstanceOf(Y.Array)

    pojo.list.push(3)
    expect(pojo.list).toEqual([1, 2, 3])
  })

  test("reusing a proxied nested object clones (independence check)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    pojo.x = { a: 1 }
    pojo.y = pojo.x

    expect(pojo.x).not.toBe(pojo.y)

    // Modifying one should not affect the other
    pojo.y.a = 2
    expect(pojo.x.a).toBe(1)
    expect(pojo.y.a).toBe(2)

    const xY = pojoToYjs(pojo.x)
    const yY = pojoToYjs(pojo.y)
    expect(xY).toBeInstanceOf(Y.Map)
    expect(yY).toBeInstanceOf(Y.Map)
    expect(xY).not.toBe(yY)
  })

  test("undefined is supported (as per Y.Map behavior)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    pojo.a = undefined
    expect(pojo.a).toBe(undefined)
    expect(ymap.get("a")).toBe(undefined)
  })

  test("reflection (keys, values, entries, iteration)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    pojo.a = 1
    pojo.b = 2
    pojo.c = null

    expect(Object.keys(pojo).sort()).toEqual(["a", "b", "c"])
    expect(Object.values(pojo).sort()).toContain(1)
    expect(Object.values(pojo).sort()).toContain(2)
    expect(Object.values(pojo).sort()).toContain(null)

    expect(Object.entries(pojo).length).toBe(3)
    expect(Object.getOwnPropertyNames(pojo).sort()).toEqual(["a", "b", "c"])
    expect(Object.getOwnPropertySymbols(pojo)).toEqual([])
    expect(Reflect.ownKeys(pojo).sort()).toEqual(["a", "b", "c"])

    const keys: string[] = []
    for (const key in pojo) {
      keys.push(key)
    }
    expect(keys.sort()).toEqual(["a", "b", "c"])

    // Symbols and non-string keys are NOT supported
    const sym = Symbol("test")
    expect(() => {
      pojo[sym as any] = 1
    }).toThrow()
    expect(pojo[sym as any]).toBeUndefined()
    expect(sym in pojo).toBe(false)

    // Object.prototype methods are NOT present by default (null prototype)
    expect(pojo.toString).toBeUndefined()
    // biome-ignore lint/suspicious/noPrototypeBuiltins: intended
    expect(Object.prototype.hasOwnProperty.call(pojo, "a")).toBe(true)
  })

  test("no-op assignment and deletion", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    pojo.a = 1

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    // No-op assignment
    pojo.a = 1
    expect(txCount).toBe(0)

    // No-op deletion
    delete pojo.b
    expect(txCount).toBe(0)

    // No-op assignment of same object proxy
    pojo.c = { x: 1 }
    txCount = 0
    // biome-ignore lint/correctness/noSelfAssign: intentionally testing self-assignment
    pojo.c = pojo.c
    expect(txCount).toBe(0)

    // Setting undefined on missing key is NOT a no-op
    txCount = 0
    pojo.d = undefined
    expect(txCount).toBe(1)
    expect(ymap.has("d")).toBe(true)

    // Setting undefined on existing undefined key IS a no-op
    txCount = 0
    pojo.d = undefined
    expect(txCount).toBe(0)
  })

  test("JSON.stringify", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)
    pojo.a = 1
    pojo.b = { c: 2 }
    expect(JSON.stringify(pojo)).toBe('{"a":1,"b":{"c":2}}')
  })

  test("getPrototypeOf and setPrototypeOf", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    expect(Object.getPrototypeOf(pojo)).toBe(null)
    expect(() => Object.setPrototypeOf(pojo, {})).toThrow()
  })

  test("Object.getOwnPropertyDescriptor", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    pojo.a = 1
    const desc = Object.getOwnPropertyDescriptor(pojo, "a")
    expect(desc).toEqual({
      configurable: true,
      enumerable: true,
      writable: true,
      value: 1,
    })

    const outDesc = Object.getOwnPropertyDescriptor(pojo, "nonExistent")
    expect(outDesc).toBeUndefined()
  })

  test("Object.defineProperty with non-value descriptors", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    expect(() => {
      Object.defineProperty(pojo, "a", {
        get() {
          return 1
        },
      })
    }).toThrow()
  })

  test("manual transaction grouping", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    doc.transact(() => {
      pojo.a = 1
      pojo.b = 2
    })

    expect(txCount).toBe(1)
    expect(pojo.a).toBe(1)
    expect(pojo.b).toBe(2)
  })

  test("circular reference detection", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    const obj: any = { a: 1 }
    obj.self = obj

    expect(() => {
      pojo.x = obj
    }).toThrow("Cyclic POJOs are not supported")
  })

  test("yjsAsPojo returns the same proxy for the same Yjs type", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const p1 = yjsAsPojo(ymap)
    const p2 = yjsAsPojo(ymap)
    expect(p1).toBe(p2)
  })

  test("assigning a proxy to another proxy clones the underlying Yjs type", () => {
    const doc = new Y.Doc()
    const ymap1 = doc.getMap("m1")
    const ymap2 = doc.getMap("m2")
    const p1 = yjsAsPojo<Record<string, any>>(ymap1)
    const p2 = yjsAsPojo<Record<string, any>>(ymap2)

    p2.a = 1
    p1.x = p2

    expect(p1.x).not.toBe(p2)
    expect(p1.x.a).toBe(1)

    // Independence check
    p1.x.a = 2
    expect(p1.x.a).toBe(2)
    expect(p2.a).toBe(1)
  })

  test("nested proxy identity (cache check)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<Record<string, any>>(ymap)

    pojo.a = { x: 1 }
    const p1 = pojo.a
    const p2 = pojo.a
    expect(p1).toBe(p2)
  })

  test("Object.isExtensible is true", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    expect(Object.isExtensible(pojo)).toBe(true)
  })

  test("Object.defineProperty updating existing value", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    pojo.a = 1
    Object.defineProperty(pojo, "a", { value: 2 })
    expect(pojo.a).toBe(2)
    expect(ymap.get("a")).toBe(2)
  })

  test("in operator for inherited properties", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)
    expect("toString" in pojo).toBe(false)
    expect("hasOwnProperty" in pojo).toBe(false)
  })

  test("assigning Object.create(null) works", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    const obj = Object.create(null)
    obj.a = 1
    pojo.x = obj
    expect(pojo.x.a).toBe(1)
    expect(Object.getPrototypeOf(pojo.x)).toBe(null)
  })

  test("Object.defineProperties", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    Object.defineProperties(pojo, {
      a: { value: 1, enumerable: true, configurable: true, writable: true },
      b: { value: 2, enumerable: true, configurable: true, writable: true },
    })

    expect(pojo.a).toBe(1)
    expect(pojo.b).toBe(2)
    expect(ymap.get("a")).toBe(1)
    expect(ymap.get("b")).toBe(2)
  })

  test("Object.freeze throws in strict mode", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    pojo.a = 1
    // Object.freeze tries to make properties non-configurable, which we don't support
    expect(() => Object.freeze(pojo)).toThrow()
  })

  test("Y.Text support (as raw value)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    const ytext = new Y.Text("hello")
    pojo.text = ytext

    expect(pojo.text).toBe(ytext)
    expect(ymap.get("text")).toBe(ytext)

    ytext.insert(5, " world")
    expect(pojo.text.toString()).toBe("hello world")
  })

  test("Object.keys order (insertion order)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    pojo.z = 1
    pojo.a = 2
    pojo.m = 3

    expect(Object.keys(pojo)).toEqual(["z", "a", "m"])
  })

  test("Object.assign with another proxy as source", () => {
    const doc = new Y.Doc()
    const ymap1 = doc.getMap("m1")
    const ymap2 = doc.getMap("m2")
    const p1 = yjsAsPojo<any>(ymap1)
    const p2 = yjsAsPojo<any>(ymap2)

    p2.a = 1
    p2.b = { c: 2 }

    Object.assign(p1, p2)

    expect(p1.a).toBe(1)
    expect(p1.b).toEqual({ c: 2 })
    expect(p1.b).not.toBe(p2.b) // Should be cloned
  })

  test("Y.XmlFragment support (as raw value)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    const xml = new Y.XmlFragment()
    pojo.xml = xml

    expect(pojo.xml).toBe(xml)
    expect(ymap.get("xml")).toBe(xml)
  })

  test("Object.values and Object.entries return proxies for nested types", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)
    pojo.a = { x: 1 }

    const values = Object.values(pojo)
    expect(values[0]).toBe(pojo.a)

    const entries = Object.entries(pojo)
    expect(entries[0][1]).toBe(pojo.a)
  })

  test("ymap.clear() is reflected in the proxy", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)
    pojo.a = 1
    pojo.b = 2

    ymap.clear()
    expect(Object.keys(pojo)).toEqual([])
    expect(pojo.a).toBeUndefined()
  })

  test("proxy mutations trigger Y.Map observe events", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    let called = false
    ymap.observe((event) => {
      expect(event.keysChanged.has("a")).toBe(true)
      called = true
    })

    pojo.a = 1
    expect(called).toBe(true)
  })

  test("Object.preventExtensions and Object.seal throw", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    expect(() => Object.preventExtensions(pojo)).toThrow()
    expect(() => Object.seal(pojo)).toThrow()
  })

  test("nested Y.Array in Y.Map", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const yarr = new Y.Array()
    yarr.push([1])
    ymap.set("list", yarr)

    const pojo = yjsAsPojo<any>(ymap)
    expect(pojo.list).toEqual([1])
    pojo.list.push(2)
    expect(yarr.toArray()).toEqual([1, 2])
  })

  test("Object.assign with plain object containing a proxy", () => {
    const doc = new Y.Doc()
    const ymap1 = doc.getMap("m1")
    const ymap2 = doc.getMap("m2")
    const p1 = yjsAsPojo<any>(ymap1)
    const p2 = yjsAsPojo<any>(ymap2)

    p2.x = 1
    Object.assign(p1, { a: p2 })

    expect(p1.a).not.toBe(p2)
    expect(p1.a.x).toBe(1)
  })

  test("Uint8Array support", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    const data = new Uint8Array([1, 2, 3])
    pojo.data = data
    expect(pojo.data).toBeInstanceOf(Uint8Array)
    expect(pojo.data).toEqual(data)
  })

  test("BigInt support", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    pojo.val = 100n
    expect(pojo.val).toBe(100n)
  })

  test("Object.assign with null/undefined sources", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)
    pojo.a = 1

    Object.assign(pojo, null, undefined)
    expect(pojo.a).toBe(1)
    expect(Object.keys(pojo)).toEqual(["a"])
  })

  test("Object.assign with array proxy as source", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const yarr = doc.getArray("a")
    const pojo = yjsAsPojo<any>(ymap)
    const list = yjsAsPojo<any[]>(yarr)

    list.push("x", "y")
    Object.assign(pojo, list)

    expect(pojo["0"]).toBe("x")
    expect(pojo["1"]).toBe("y")
  })

  test("Object.assign throws on symbol properties", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    const sym = Symbol("test")
    const source = { [sym]: 1 }
    expect(() => {
      Object.assign(pojo, source)
    }).toThrow()
  })
})
