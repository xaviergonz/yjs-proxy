import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { markAsJs, toYjsProxy, unwrapYjs } from "../src"
import { wrapYjs } from "../src/wrapYjs"

describe("unwrapYjs", () => {
  test("returns the underlying Y.js value for proxies", () => {
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

  test("throws for non-proxy values", () => {
    // Plain objects/arrays
    expect(() => unwrapYjs({})).toThrow("Value is not a yjs-proxy proxy")
    expect(() => unwrapYjs([])).toThrow("Value is not a yjs-proxy proxy")
    expect(() => unwrapYjs({ a: 1 })).toThrow("Value is not a yjs-proxy proxy")

    // markAsJs
    expect(() => unwrapYjs(markAsJs({}))).toThrow("Value is not a yjs-proxy proxy")

    // Primitives
    expect(() => unwrapYjs(null)).toThrow("Value is not a yjs-proxy proxy")
    expect(() => unwrapYjs(undefined)).toThrow("Value is not a yjs-proxy proxy")
    expect(() => unwrapYjs(123 as any)).toThrow("Value is not a yjs-proxy proxy")
    expect(() => unwrapYjs("string" as any)).toThrow("Value is not a yjs-proxy proxy")

    // Y.js values themselves
    expect(() => unwrapYjs(new Y.Map())).toThrow("Value is not a yjs-proxy proxy")
    expect(() => unwrapYjs(new Y.Array())).toThrow("Value is not a yjs-proxy proxy")
  })

  test("returns undefined for detached proxies", () => {
    const proxy = toYjsProxy({ a: 1 })
    expect(unwrapYjs(proxy)).toBeUndefined()
  })

  test("identity is preserved when switching between detached and attached modes", () => {
    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap()) as any

    const p1 = toYjsProxy({ a: 1 })
    expect(unwrapYjs(p1)).toBeUndefined()

    // Attach
    root.p = p1
    expect(unwrapYjs(p1)).toBeDefined()
    expect(unwrapYjs(p1)).toBe(doc.getMap().get("p"))

    // Detach
    delete root.p

    expect(unwrapYjs(p1)).toBeUndefined()
    expect(p1.a).toBe(1)
  })
})
