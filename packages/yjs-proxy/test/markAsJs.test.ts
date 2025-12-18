import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { isMarkedAsJs, markAsJs, unwrapYjs, wrapYjs } from "../src/index"

describe("markAsJs", () => {
  test("stores raw JS object/array and deep freezes it", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)

    const original = { a: 1, nested: { b: 2 } }
    const raw = markAsJs(original)

    expect(raw).not.toBe(original) // Shallow clone
    expect(raw).toEqual(original)
    expect(Object.isFrozen(raw)).toBe(true)
    expect(Object.isFrozen(raw.nested)).toBe(true)
    expect(isMarkedAsJs(raw)).toBe(true)

    js.x = raw
    expect(js.x).toEqual(original)
    expect(isMarkedAsJs(js.x)).toBe(true)
    expect(Object.isFrozen(js.x)).toBe(true)
    expect(unwrapYjs(js.x.nested)).toBeUndefined()

    const stored = ymap.get("x")
    expect(stored).not.toBeInstanceOf(Y.Map)
    expect(stored).toEqual(original)

    // Array check
    const originalArr = [1, 2]
    const rawArr = markAsJs(originalArr)
    expect(rawArr).not.toBe(originalArr)
    expect(isMarkedAsJs(rawArr)).toBe(true)
    js.y = rawArr
    expect(js.y).toEqual(originalArr)
  })

  test("loading from Yjs automatically marks as raw and freezes", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    ymap.set("plain", { hello: "world", nested: { a: 1 } })

    const js = wrapYjs<any>(ymap)
    const val = js.plain

    expect(isMarkedAsJs(val)).toBe(true)
    expect(Object.isFrozen(val)).toBe(true)
    expect(Object.isFrozen(val.nested)).toBe(true)
    expect(val.hello).toBe("world")
  })

  test("mutation of markAsJs throws", () => {
    const raw = markAsJs({ a: 1 })
    expect(() => {
      ;(raw as any).a = 2
    }).toThrow()
  })

  test("TypedArrays are preserved", () => {
    const data = new Uint8Array([1, 2, 3])
    const raw = markAsJs({ data })

    expect(Object.isFrozen(raw)).toBe(true)
    expect(raw.data).toBe(data)

    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const js = wrapYjs<any>(ymap)
    js.x = raw

    expect(js.x.data).toBeInstanceOf(Uint8Array)
    expect(Array.from(js.x.data)).toEqual([1, 2, 3])
  })

  test("identity stability", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    ymap.set("raw", { a: 1 })

    const js = wrapYjs<any>(ymap)
    const val1 = js.raw
    const val2 = js.raw

    expect(val1).toBe(val2)
    expect(isMarkedAsJs(val1)).toBe(true)
  })
})
