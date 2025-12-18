import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { getYjsForPojo, pojoToYjs, rawPojo, yjsAsPojo } from "../src/index"

describe("pojoToYjs", () => {
  test("converts POJOs to Yjs types recursively", () => {
    const doc = new Y.Doc()
    const bin = new Uint8Array([1, 2, 3])
    const raw = rawPojo({ secret: 42 })

    const obj = {
      a: 1,
      arr: [2, { b: 3 }],
      bin,
      raw,
    }

    const ymap = pojoToYjs(obj) as Y.Map<any>
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
    const proxy = yjsAsPojo(ymap)

    // Proxy unwrapping
    expect(pojoToYjs(proxy)).toBe(ymap)

    // As-is
    expect(pojoToYjs(ymap)).toBe(ymap)

    // Cloning if parented
    const child = new Y.Map()
    ymap.set("child", child)
    const result = pojoToYjs({ other: child }) as Y.Map<any>
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
    expect(() => pojoToYjs(cyclic)).toThrow("Cyclic POJOs are not supported")

    // Invalid top-level
    expect(() => pojoToYjs(123 as any)).toThrow("Value cannot be converted to a Yjs Map or Array")
    expect(() => pojoToYjs(null as any)).toThrow()
  })

  test("preserves identity of nested proxies when converting back", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    pojo.nested = { a: 1 }
    const nestedProxy = pojo.nested

    const result = pojoToYjs(pojo)
    expect(result).toBe(ymap)

    const nestedYMap = ymap.get("nested")
    expect(getYjsForPojo(nestedProxy)).toBe(nestedYMap)
  })
})
