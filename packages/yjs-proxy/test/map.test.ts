import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { toYjsProxy, unwrapYjs } from "../src"
import { wrapYjs } from "../src/wrapYjs"

describe("wrapYjs (Y.Map)", () => {
  test("basic CRUD operations", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    // Set and Get
    js.a = 1
    js.b = "x"
    expect(js.a).toBe(1)
    expect(js.b).toBe("x")

    // in operator
    expect("a" in js).toBe(true)
    expect("c" in js).toBe(false)

    // Delete
    delete js.a
    expect("a" in js).toBe(false)
    expect(ymap.has("a")).toBe(false)

    // Object.assign
    Object.assign(js, { c: 3, d: 4 })
    expect(js.c).toBe(3)
    expect(js.d).toBe(4)
  })

  test("nested structures (objects and arrays)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    // Nested object
    js.obj = { a: 1 }
    expect(js.obj.a).toBe(1)
    expect(unwrapYjs(js.obj)).toBeInstanceOf(Y.Map)

    // Nested array
    js.list = [1, 2]
    expect(js.list).toEqual([1, 2])
    expect(unwrapYjs(js.list)).toBeInstanceOf(Y.Array)

    js.list.push(3)
    expect(js.list).toEqual([1, 2, 3])
  })

  test("reusing a proxied nested object creates alias (sync check)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    js.x = { a: 1 }
    js.y = js.x

    expect(js.x).not.toBe(js.y)

    // With aliasing, modifying one DOES affect the other
    js.y.a = 2
    expect(js.x.a).toBe(2)
    expect(js.y.a).toBe(2)

    const xY = unwrapYjs(js.x)
    const yY = unwrapYjs(js.y)
    expect(xY).toBeInstanceOf(Y.Map)
    expect(yY).toBeInstanceOf(Y.Map)
    expect(xY).not.toBe(yY)
  })

  test("undefined is supported (as per Y.Map behavior)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    js.a = undefined
    expect(js.a).toBe(undefined)
    expect(ymap.get("a")).toBe(undefined)
  })

  test("reflection (keys, values, entries, iteration)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    js.a = 1
    js.b = 2
    js.c = null

    expect(Object.keys(js).sort()).toEqual(["a", "b", "c"])
    expect(Object.values(js).sort()).toContain(1)
    expect(Object.values(js).sort()).toContain(2)
    expect(Object.values(js).sort()).toContain(null)

    expect(Object.entries(js).length).toBe(3)
    expect(Object.getOwnPropertyNames(js).sort()).toEqual(["a", "b", "c"])
    expect(Object.getOwnPropertySymbols(js)).toEqual([])
    expect(Reflect.ownKeys(js).sort()).toEqual(["a", "b", "c"])

    const keys: string[] = []
    for (const key in js) {
      keys.push(key)
    }
    expect(keys.sort()).toEqual(["a", "b", "c"])

    // Symbols and non-string keys are NOT supported
    const sym = Symbol("test")
    expect(() => {
      js[sym as any] = 1
    }).toThrow()
    expect(js[sym as any]).toBeUndefined()
    expect(sym in js).toBe(false)

    // Object.prototype methods are NOT present by default (null prototype)
    expect(js.toString).toBeUndefined()
    // biome-ignore lint/suspicious/noPrototypeBuiltins: intended
    expect(Object.prototype.hasOwnProperty.call(js, "a")).toBe(true)
  })

  test("no-op assignment and deletion", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    js.a = 1

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    // No-op assignment
    js.a = 1
    expect(txCount).toBe(0)

    // No-op deletion
    delete js.b
    expect(txCount).toBe(0)

    // No-op assignment of same object proxy
    js.c = { x: 1 }
    txCount = 0
    // biome-ignore lint/correctness/noSelfAssign: intentionally testing self-assignment
    js.c = js.c
    expect(txCount).toBe(0)

    // Setting undefined on missing key is NOT a no-op
    txCount = 0
    js.d = undefined
    expect(txCount).toBe(1)
    expect(ymap.has("d")).toBe(true)

    // Setting undefined on existing undefined key IS a no-op
    txCount = 0
    js.d = undefined
    expect(txCount).toBe(0)
  })

  test("JSON.stringify", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)
    js.a = 1
    js.b = { c: 2 }
    expect(JSON.stringify(js)).toBe('{"a":1,"b":{"c":2}}')
  })

  test("getPrototypeOf and setPrototypeOf", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    expect(Object.getPrototypeOf(js)).toBe(null)
    expect(() => Object.setPrototypeOf(js, {})).toThrow()
  })

  test("Object.getOwnPropertyDescriptor", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    js.a = 1
    const desc = Object.getOwnPropertyDescriptor(js, "a")
    expect(desc).toEqual({
      configurable: true,
      enumerable: true,
      writable: true,
      value: 1,
    })

    const outDesc = Object.getOwnPropertyDescriptor(js, "nonExistent")
    expect(outDesc).toBeUndefined()
  })

  test("Object.defineProperty with non-value descriptors", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    expect(() => {
      Object.defineProperty(js, "a", {
        get() {
          return 1
        },
      })
    }).toThrow()
  })

  test("manual transaction grouping", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    let txCount = 0
    doc.on("afterTransaction", () => {
      txCount++
    })

    doc.transact(() => {
      js.a = 1
      js.b = 2
    })

    expect(txCount).toBe(1)
    expect(js.a).toBe(1)
    expect(js.b).toBe(2)
  })

  test("circular reference detection", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    const obj: any = { a: 1 }
    obj.self = obj

    expect(() => {
      js.x = obj
    }).toThrow("Cyclic objects are not supported")
  })

  test("wrapYjs returns the same proxy for the same Y.js value", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const p1 = wrapYjs(ymap)
    const p2 = wrapYjs(ymap)
    expect(p1).toBe(p2)
  })

  test("assigning a proxy to another proxy creates alias for the underlying Y.js value", () => {
    const doc = new Y.Doc()
    const ymap1 = doc.getMap("m1")
    const ymap2 = doc.getMap("m2")
    const p1 = wrapYjs<Record<string, any>>(ymap1)
    const p2 = wrapYjs<Record<string, any>>(ymap2)

    p2.a = 1
    p1.x = p2

    expect(p1.x).not.toBe(p2)
    expect(p1.x.a).toBe(1)

    // With aliasing, modifying one DOES affect the other
    p1.x.a = 2
    expect(p1.x.a).toBe(2)
    expect(p2.a).toBe(2)
  })

  test("nested proxy identity (cache check)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<Record<string, any>>(ymap)

    js.a = { x: 1 }
    const p1 = js.a
    const p2 = js.a
    expect(p1).toBe(p2)
  })

  test("Object.isExtensible is true", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    expect(Object.isExtensible(js)).toBe(true)
  })

  test("Object.defineProperty updating existing value", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    js.a = 1
    Object.defineProperty(js, "a", { value: 2 })
    expect(js.a).toBe(2)
    expect(ymap.get("a")).toBe(2)
  })

  test("in operator for inherited properties", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)
    expect("toString" in js).toBe(false)
    expect("hasOwnProperty" in js).toBe(false)
  })

  test("assigning Object.create(null) works", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    const obj = Object.create(null)
    obj.a = 1
    js.x = obj
    expect(js.x.a).toBe(1)
    expect(Object.getPrototypeOf(js.x)).toBe(null)
  })

  test("Object.defineProperties", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    Object.defineProperties(js, {
      a: { value: 1, enumerable: true, configurable: true, writable: true },
      b: { value: 2, enumerable: true, configurable: true, writable: true },
    })

    expect(js.a).toBe(1)
    expect(js.b).toBe(2)
    expect(ymap.get("a")).toBe(1)
    expect(ymap.get("b")).toBe(2)
  })

  test("Object.freeze throws in strict mode", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    js.a = 1
    // Object.freeze tries to make properties non-configurable, which we don't support
    expect(() => Object.freeze(js)).toThrow()
  })

  test("Y.Text support (as raw value)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    const ytext = new Y.Text("hello")
    js.text = ytext

    expect(js.text).toBe(ytext)
    expect(ymap.get("text")).toBe(ytext)

    ytext.insert(5, " world")
    expect(js.text.toString()).toBe("hello world")
  })

  test("Object.keys order (insertion order)", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    js.z = 1
    js.a = 2
    js.m = 3

    expect(Object.keys(js)).toEqual(["z", "a", "m"])
  })

  test("Object.assign with another proxy as source", () => {
    const doc = new Y.Doc()
    const ymap1 = doc.getMap("m1")
    const ymap2 = doc.getMap("m2")
    const p1 = wrapYjs<any>(ymap1)
    const p2 = wrapYjs<any>(ymap2)

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
    const js = wrapYjs<any>(ymap)

    const xml = new Y.XmlFragment()
    js.xml = xml

    expect(js.xml).toBe(xml)
    expect(ymap.get("xml")).toBe(xml)
  })

  test("Object.values and Object.entries return proxies for nested types", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)
    js.a = { x: 1 }

    const values = Object.values(js)
    expect(values[0]).toBe(js.a)

    const entries = Object.entries(js)
    expect(entries[0][1]).toBe(js.a)
  })

  test("ymap.clear() is reflected in the proxy", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)
    js.a = 1
    js.b = 2

    ymap.clear()
    expect(Object.keys(js)).toEqual([])
    expect(js.a).toBeUndefined()
  })

  test("proxy mutations trigger Y.Map observe events", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    let called = false
    ymap.observe((event) => {
      expect(event.keysChanged.has("a")).toBe(true)
      called = true
    })

    js.a = 1
    expect(called).toBe(true)
  })

  test("Object.preventExtensions and Object.seal throw", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    expect(() => Object.preventExtensions(js)).toThrow()
    expect(() => Object.seal(js)).toThrow()
  })

  test("nested Y.Array in Y.Map", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const yarr = new Y.Array()
    yarr.push([1])
    ymap.set("list", yarr)

    const js = wrapYjs<any>(ymap)
    expect(js.list).toEqual([1])
    js.list.push(2)
    expect(yarr.toArray()).toEqual([1, 2])
  })

  test("Object.assign with plain object containing a proxy", () => {
    const doc = new Y.Doc()
    const ymap1 = doc.getMap("m1")
    const ymap2 = doc.getMap("m2")
    const p1 = wrapYjs<any>(ymap1)
    const p2 = wrapYjs<any>(ymap2)

    p2.x = 1
    Object.assign(p1, { a: p2 })

    expect(p1.a).not.toBe(p2)
    expect(p1.a.x).toBe(1)
  })

  test("Uint8Array support", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    const data = new Uint8Array([1, 2, 3])
    js.data = data
    expect(js.data).toBeInstanceOf(Uint8Array)
    expect(js.data).toEqual(data)
  })

  test("BigInt support", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    js.val = 100n
    expect(js.val).toBe(100n)
  })

  test("Object.assign with null/undefined sources", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)
    js.a = 1

    Object.assign(js, null, undefined)
    expect(js.a).toBe(1)
    expect(Object.keys(js)).toEqual(["a"])
  })

  test("Object.assign with array proxy as source", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const yarr = doc.getArray("a")
    const js = wrapYjs<any>(ymap)
    const list = wrapYjs<any[]>(yarr)

    list.push("x", "y")
    Object.assign(js, list)

    expect(js["0"]).toBe("x")
    expect(js["1"]).toBe("y")
  })

  test("Object.assign throws on symbol properties", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    const sym = Symbol("test")
    const source = { [sym]: 1 }
    expect(() => {
      Object.assign(js, source)
    }).toThrow()
  })

  test("detached mode: deleteProperty and defineProperty", () => {
    const map = toYjsProxy({ a: 1, b: 2 }) as any

    // deleteProperty
    delete map.a
    expect(map.a).toBeUndefined()
    expect("a" in map).toBe(false)

    // deleteProperty with non-string key
    const sym = Symbol("test")
    expect(delete map[sym]).toBe(true)

    // ownKeys
    expect(Object.keys(map)).toEqual(["b"])

    // defineProperty with non-string key
    expect(() => {
      Object.defineProperty(map, sym, { value: 1 })
    }).toThrow()
  })
})
