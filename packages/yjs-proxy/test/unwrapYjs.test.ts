import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { markAsJs, unwrapYjs, wrapYjs } from "../src/index"

describe("unwrapYjs", () => {
  test("returns the underlying Yjs type for proxies", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const yarr = doc.getArray("a")

    const mapProxy = wrapYjs(ymap)
    const arrayProxy = wrapYjs(yarr)

    expect(unwrapYjs(mapProxy)).toBe(ymap)
    expect(unwrapYjs(arrayProxy)).toBe(yarr)

    // Nested
    const js = mapProxy as any
    js.nested = { a: 1 }
    expect(unwrapYjs(js.nested)).toBe(ymap.get("nested"))
  })

  test("returns undefined for non-proxy values", () => {
    // Plain objects/arrays
    expect(unwrapYjs({})).toBeUndefined()
    expect(unwrapYjs([])).toBeUndefined()
    expect(unwrapYjs({ a: 1 })).toBeUndefined()

    // markAsJs
    expect(unwrapYjs(markAsJs({}))).toBeUndefined()

    // Primitives
    expect(unwrapYjs(null)).toBeUndefined()
    expect(unwrapYjs(undefined)).toBeUndefined()
    expect(unwrapYjs(123 as any)).toBeUndefined()
    expect(unwrapYjs("string" as any)).toBeUndefined()

    // Yjs types themselves
    expect(unwrapYjs(new Y.Map())).toBeUndefined()
    expect(unwrapYjs(new Y.Array())).toBeUndefined()
  })
})
