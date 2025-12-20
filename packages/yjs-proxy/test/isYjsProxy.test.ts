import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { isYjsProxy, markAsJs, toYjsProxy, wrapYjs } from "../src/index"

describe("isYjsProxy", () => {
  test("returns true for proxies", () => {
    const doc = new Y.Doc()
    const proxy = wrapYjs(doc.getMap())
    expect(isYjsProxy(proxy)).toBe(true)

    const jsonProxy = toYjsProxy({ a: 1 })
    expect(isYjsProxy(jsonProxy)).toBe(true)
  })

  test("returns false for non-proxies", () => {
    expect(isYjsProxy({})).toBe(false)
    expect(isYjsProxy([])).toBe(false)
    expect(isYjsProxy(null)).toBe(false)
    expect(isYjsProxy(new Y.Map())).toBe(false)
    expect(isYjsProxy(markAsJs({}))).toBe(false)
  })
})
