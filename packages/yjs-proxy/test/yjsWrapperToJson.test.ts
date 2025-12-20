import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { markAsJs, toYjsProxy, wrapYjs, yjsWrapperToJson } from "../src/index"

describe("yjsWrapperToJson", () => {
  test("converts proxies to plain JSON recursively", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    const bin = new Uint8Array([1, 2, 3])
    const raw = markAsJs({ secret: 42 })

    js.a = 1
    js.obj = { b: 2 }
    js.arr = [3, { c: 4 }]
    js.bin = bin
    js.raw = raw

    const json = yjsWrapperToJson(js)

    expect(json).toEqual({
      a: 1,
      obj: { b: 2 },
      arr: [3, { c: 4 }],
      bin: bin,
      raw: { secret: 42 },
    })

    // Verify they are plain objects/arrays
    expect(Object.getPrototypeOf(json)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(json.obj)).toBe(Object.prototype)
    expect(Array.isArray(json.arr)).toBe(true)
    expect(Object.getPrototypeOf(json.arr[1])).toBe(Object.prototype)
    expect(json.bin).toBeInstanceOf(Uint8Array)
  })

  test("works with proxies in JSON mode (toYjsProxy)", () => {
    const o = { a: 1, b: { c: 2 }, d: [3, 4] }
    const proxy = toYjsProxy(o)

    const json = yjsWrapperToJson(proxy)
    expect(json).toEqual(o)
    expect(json).not.toBe(o) // Should be a clone
    expect(json.b).not.toBe(o.b)
    expect(json.d).not.toBe(o.d)
  })

  test("works with detached proxies (JSON mode)", () => {
    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap())
    root.o = { a: 1 }
    const oProxy = root.o

    // Detach
    root.o = undefined

    const json = yjsWrapperToJson(oProxy)
    expect(json).toEqual({ a: 1 })

    // Modify while detached
    oProxy.a = 2
    expect(yjsWrapperToJson(oProxy)).toEqual({ a: 2 })
  })

  test("throws on non-proxy values", () => {
    expect(() => yjsWrapperToJson({})).toThrow("Value is not a yjs-proxy proxy")
    expect(() => yjsWrapperToJson([])).toThrow("Value is not a yjs-proxy proxy")
    expect(() => yjsWrapperToJson(null as any)).toThrow("Value is not a yjs-proxy proxy")
    expect(() => yjsWrapperToJson(123 as any)).toThrow("Value is not a yjs-proxy proxy")
  })
})
