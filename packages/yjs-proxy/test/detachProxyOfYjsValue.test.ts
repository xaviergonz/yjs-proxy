import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { detachProxyOfYjsValue } from "../src/detachProxyOfYjsValue"
import { toYjsProxy, unwrapYjs, wrapYjs } from "../src/index"

describe("detachProxyOfYjsValue", () => {
  test("returns undefined for non-Yjs values", () => {
    expect(detachProxyOfYjsValue({})).toBeUndefined()
  })

  test("returns state.json if already detached", () => {
    const p = toYjsProxy({ a: 1 })
    // We need to get the underlying Yjs value to call detachProxyOfYjsValue on it,
    // but detached proxies don't have one.
    // However, detachProxyOfYjsValueAndGetJSON is called recursively.

    const doc = new Y.Doc()
    const root = wrapYjs<any>(doc.getMap())
    root.p = p

    const ymap = unwrapYjs(p)!
    detachProxyOfYjsValue(ymap) // First time

    // Second time should hit the "already detached" branch
    expect(detachProxyOfYjsValue(ymap)).toBe(p)
  })

  test("throws if no doc", () => {
    const ymap = new Y.Map()
    expect(() => detachProxyOfYjsValue(ymap)).toThrow("Cannot create JSON representation")
  })

  test("fallback for Y.Text", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const ytext = new Y.Text("hello")
    ymap.set("t", ytext)

    const p = wrapYjs<any>(ymap)
    detachProxyOfYjsValue(ymap)

    expect(p.t).toBe("hello")
  })
})
