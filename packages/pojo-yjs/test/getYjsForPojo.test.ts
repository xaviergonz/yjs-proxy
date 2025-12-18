import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { getYjsForPojo, rawPojo, yjsAsPojo } from "../src/index"

describe("getYjsForPojo", () => {
  test("returns the underlying Yjs type for proxies", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const yarr = doc.getArray("a")

    const mapProxy = yjsAsPojo(ymap)
    const arrayProxy = yjsAsPojo(yarr)

    expect(getYjsForPojo(mapProxy)).toBe(ymap)
    expect(getYjsForPojo(arrayProxy)).toBe(yarr)

    // Nested
    const pojo = mapProxy as any
    pojo.nested = { a: 1 }
    expect(getYjsForPojo(pojo.nested)).toBe(ymap.get("nested"))
  })

  test("returns undefined for non-proxy values", () => {
    // Plain objects/arrays
    expect(getYjsForPojo({})).toBeUndefined()
    expect(getYjsForPojo([])).toBeUndefined()
    expect(getYjsForPojo({ a: 1 })).toBeUndefined()

    // rawPojo
    expect(getYjsForPojo(rawPojo({}))).toBeUndefined()

    // Primitives
    expect(getYjsForPojo(null)).toBeUndefined()
    expect(getYjsForPojo(undefined)).toBeUndefined()
    expect(getYjsForPojo(123 as any)).toBeUndefined()
    expect(getYjsForPojo("string" as any)).toBeUndefined()

    // Yjs types themselves
    expect(getYjsForPojo(new Y.Map())).toBeUndefined()
    expect(getYjsForPojo(new Y.Array())).toBeUndefined()
  })
})
