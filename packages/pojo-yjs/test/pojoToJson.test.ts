import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { pojoToJson, rawPojo, yjsAsPojo } from "../src/index"

describe("pojoToJson", () => {
  test("converts proxies to plain JSON recursively", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    const bin = new Uint8Array([1, 2, 3])
    const raw = rawPojo({ secret: 42 })

    pojo.a = 1
    pojo.obj = { b: 2 }
    pojo.arr = [3, { c: 4 }]
    pojo.bin = bin
    pojo.raw = raw

    const json = pojoToJson(pojo)

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
    expect(() => pojoToJson({})).toThrow("pojoToJson only supports yjsAsPojo proxies")
    expect(() => pojoToJson([])).toThrow("pojoToJson only supports yjsAsPojo proxies")
    expect(() => pojoToJson(null)).toThrow("pojoToJson only supports yjsAsPojo proxies")
    expect(() => pojoToJson(123 as any)).toThrow("pojoToJson only supports yjsAsPojo proxies")
  })
})
