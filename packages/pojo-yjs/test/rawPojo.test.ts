import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { getYjsForPojo, isRawPojo, rawPojo, yjsAsPojo } from "../src/index"

describe("rawPojo", () => {
  test("stores raw JS object/array and deep freezes it", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)

    const original = { a: 1, nested: { b: 2 } }
    const raw = rawPojo(original)

    expect(raw).not.toBe(original) // Shallow clone
    expect(raw).toEqual(original)
    expect(Object.isFrozen(raw)).toBe(true)
    expect(Object.isFrozen(raw.nested)).toBe(true)
    expect(isRawPojo(raw)).toBe(true)

    pojo.x = raw
    expect(pojo.x).toEqual(original)
    expect(isRawPojo(pojo.x)).toBe(true)
    expect(Object.isFrozen(pojo.x)).toBe(true)
    expect(getYjsForPojo(pojo.x.nested)).toBeUndefined()

    const stored = ymap.get("x")
    expect(stored).not.toBeInstanceOf(Y.Map)
    expect(stored).toEqual(original)

    // Array check
    const originalArr = [1, 2]
    const rawArr = rawPojo(originalArr)
    expect(rawArr).not.toBe(originalArr)
    expect(isRawPojo(rawArr)).toBe(true)
    pojo.y = rawArr
    expect(pojo.y).toEqual(originalArr)
  })

  test("loading from Yjs automatically marks as raw and freezes", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    ymap.set("plain", { hello: "world", nested: { a: 1 } })

    const pojo = yjsAsPojo<any>(ymap)
    const val = pojo.plain

    expect(isRawPojo(val)).toBe(true)
    expect(Object.isFrozen(val)).toBe(true)
    expect(Object.isFrozen(val.nested)).toBe(true)
    expect(val.hello).toBe("world")
  })

  test("mutation of rawPojo throws", () => {
    const raw = rawPojo({ a: 1 })
    expect(() => {
      ;(raw as any).a = 2
    }).toThrow()
  })

  test("TypedArrays are preserved", () => {
    const data = new Uint8Array([1, 2, 3])
    const raw = rawPojo({ data })

    expect(Object.isFrozen(raw)).toBe(true)
    expect(raw.data).toBe(data)

    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const pojo = yjsAsPojo<any>(ymap)
    pojo.x = raw

    expect(pojo.x.data).toBeInstanceOf(Uint8Array)
    expect(Array.from(pojo.x.data)).toEqual([1, 2, 3])
  })

  test("identity stability", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    ymap.set("raw", { a: 1 })

    const pojo = yjsAsPojo<any>(ymap)
    const val1 = pojo.raw
    const val2 = pojo.raw

    expect(val1).toBe(val2)
    expect(isRawPojo(val1)).toBe(true)
  })
})
