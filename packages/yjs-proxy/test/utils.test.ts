import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { isPlainObject, transactIfPossible } from "../src/utils"

describe("utils", () => {
  test("isPlainObject", () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(123)).toBe(false)
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  test("transactIfPossible without doc", () => {
    const ymap = new Y.Map()
    let called = false
    transactIfPossible(ymap, () => {
      called = true
    })
    expect(called).toBe(true)
  })

  test("transactIfPossible with doc", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    let called = false
    transactIfPossible(ymap, () => {
      called = true
    })
    expect(called).toBe(true)
  })
})
