import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { convertJsToYjsValue } from "../src/conversion"
import { unwrapYjs, wrapYjs } from "../src/index"
import { markAsJs } from "../src/markAsJs"

describe("convertJsToYjsValue", () => {
  test("unsupported type", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)
    expect(() => {
      js.a = new Date()
    }).toThrow("Unsupported value type")
  })

  test("already attached proxy", () => {
    const doc1 = new Y.Doc()
    const ymap1 = doc1.getMap("m1")
    const p1 = wrapYjs<any>(ymap1)

    const doc2 = new Y.Doc()
    const ymap2 = doc2.getMap("m2")
    const p2 = wrapYjs<any>(ymap2)

    // p1 is already attached to doc1.
    // Assigning it to p2 should clone it.
    p2.a = p1
    expect(p2.a).not.toBe(p1)
    expect(unwrapYjs(p2.a)).not.toBe(ymap1)
  })

  test("unparented seen twice throws", () => {
    const ymap = new Y.Map()
    const seen = new WeakSet<object>()
    // This should throw because we can't clone an unparented Y.js value twice
    // (actually we can't clone it at all if it's unparented, but we allow it once)
    convertJsToYjsValue(ymap, seen)
    expect(() => convertJsToYjsValue(ymap, seen)).toThrow("Cannot clone an unparented Y.js value")
  })

  test("throws on deleted types", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    ymap.set("a", new Y.Map())
    const sub = ymap.get("a") as Y.Map<any>
    ymap.delete("a")

    const doc2 = new Y.Doc()
    const proxy = wrapYjs<any>(doc2.getMap())
    expect(() => {
      proxy.x = sub
    }).toThrow("Cannot wrap a deleted Y.js value")
  })

  test("cyclic objects are not supported", () => {
    const cyclic: any = { a: 1 }
    cyclic.self = cyclic
    expect(() => convertJsToYjsValue(cyclic)).toThrow("Cyclic objects are not supported")
  })

  test("marked as JS values are returned as-is", () => {
    const obj = markAsJs({ a: 1 })
    expect(convertJsToYjsValue(obj)).toBe(obj)
  })
})
