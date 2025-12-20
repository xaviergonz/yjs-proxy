import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { markAsJs, toYjs, wrapYjs } from "../src/index"

describe("toYjs", () => {
  test("converts JS objects to Y.js values recursively", () => {
    const doc = new Y.Doc()
    const bin = new Uint8Array([1, 2, 3])
    const raw = markAsJs({ secret: 42 })

    const obj = {
      a: 1,
      arr: [2, { b: 3 }],
      bin,
      raw,
    }

    const ymap = toYjs(obj) as Y.Map<any>
    doc.getArray("root").insert(0, [ymap])

    expect(ymap).toBeInstanceOf(Y.Map)
    expect(ymap.get("a")).toBe(1)
    expect(ymap.get("arr")).toBeInstanceOf(Y.Array)
    expect(ymap.get("bin")).toBeInstanceOf(Uint8Array)
    expect(ymap.get("raw")).toBe(raw)

    const yarr = ymap.get("arr") as Y.Array<any>
    expect(yarr.get(1)).toBeInstanceOf(Y.Map)
    expect((yarr.get(1) as Y.Map<any>).get("b")).toBe(3)
  })

  test("throws on existing Y.js values and proxies", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const proxy = wrapYjs(ymap)

    // Proxy
    expect(() => toYjs(proxy)).toThrow("Value is already a yjs-proxy proxy")

    // As-is
    expect(() => toYjs(ymap)).toThrow("Value is already a Y.js value")

    // Nested Y.js values are still cloned by convertJsToYjsValue
    const child = new Y.Map()
    child.set("a", 1)
    const result = toYjs({ other: child }) as Y.Map<any>
    // We need to add it to a doc to read it if it was cloned/unparented
    const doc2 = new Y.Doc()
    doc2.getArray("root").insert(0, [result])
    expect(result.get("other")).toBeInstanceOf(Y.Map)
    expect(result.get("other").toJSON()).toEqual({ a: 1 })
  })

  test("throws on invalid inputs", () => {
    // Invalid top-level
    expect(() => toYjs(123 as any)).toThrow("Value cannot be converted to a Y.js Map or Array")
    expect(() => toYjs(null as any)).toThrow()
  })
})
