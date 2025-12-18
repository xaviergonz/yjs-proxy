import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { markAsJs, toYjs, unwrapYjs, wrapYjs } from "../src/index"

describe("toYjs", () => {
  test("converts JS objects to Yjs types recursively", () => {
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

  test("handles existing Yjs types and proxies", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const proxy = wrapYjs(ymap)

    // Proxy unwrapping
    expect(toYjs(proxy)).toBe(ymap)

    // As-is
    expect(toYjs(ymap)).toBe(ymap)

    // Cloning if parented
    const child = new Y.Map()
    ymap.set("child", child)
    const result = toYjs({ other: child }) as Y.Map<any>
    const resultDoc = new Y.Doc()
    resultDoc.getArray("root").insert(0, [result])

    expect(result.get("other")).toBeInstanceOf(Y.Map)
    expect(result.get("other")).not.toBe(child)
    expect(result.get("other").parent).toBe(result)
  })

  test("throws on invalid inputs", () => {
    // Cyclic
    const cyclic: any = { a: 1 }
    cyclic.self = cyclic
    expect(() => toYjs(cyclic)).toThrow("Cyclic objects are not supported")

    // Invalid top-level
    expect(() => toYjs(123 as any)).toThrow("Value cannot be converted to a Yjs Map or Array")
    expect(() => toYjs(null as any)).toThrow()
  })

  test("preserves identity of nested proxies when converting back", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    js.nested = { a: 1 }
    const nestedProxy = js.nested

    const result = toYjs(js)
    expect(result).toBe(ymap)

    const nestedYMap = ymap.get("nested")
    expect(unwrapYjs(nestedProxy)).toBe(nestedYMap)
  })
})
