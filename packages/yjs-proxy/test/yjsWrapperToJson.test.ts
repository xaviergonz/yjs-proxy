import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { markAsJs, wrapYjs, yjsWrapperToJson } from "../src/index"

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

  test("throws on non-proxy values", () => {
    expect(() => yjsWrapperToJson({})).toThrow("yjsWrapperToJson only supports wrapYjs proxies")
    expect(() => yjsWrapperToJson([])).toThrow("yjsWrapperToJson only supports wrapYjs proxies")
    expect(() => yjsWrapperToJson(null)).toThrow("yjsWrapperToJson only supports wrapYjs proxies")
    expect(() => yjsWrapperToJson(123 as any)).toThrow(
      "yjsWrapperToJson only supports wrapYjs proxies"
    )
  })
})
