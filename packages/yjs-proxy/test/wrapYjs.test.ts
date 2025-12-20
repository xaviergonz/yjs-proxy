import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { wrapYjs } from "../src/index"

describe("wrapYjs", () => {
  test("wrapYjs unsupported type", () => {
    expect(() => wrapYjs(new Y.Text() as any)).toThrow("wrapYjs only supports Y.Map and Y.Array")
  })

  test("throws on deleted types", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    ymap.set("a", new Y.Map())
    const sub = ymap.get("a") as Y.Map<any>
    ymap.delete("a")

    expect(() => wrapYjs(sub)).toThrow("Cannot wrap a deleted Y.js value")
  })

  test("accessing a proxy of a deleted type throws", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    ymap.set("a", new Y.Map())
    const sub = ymap.get("a") as Y.Map<any>
    const proxy = wrapYjs<any>(sub)

    ymap.delete("a")

    expect(() => proxy.foo).toThrow("Y.js value is deleted")
  })
})
