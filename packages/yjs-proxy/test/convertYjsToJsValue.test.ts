import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { convertYjsToJsValue } from "../src/conversion"

describe("convertYjsToJsValue", () => {
  test("throws on deleted types", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    ymap.set("a", new Y.Map([["x", 1]]))
    const sub = ymap.get("a") as Y.Map<any>
    ymap.delete("a")

    // Now 'sub' is deleted.
    expect(() => convertYjsToJsValue(sub)).toThrow("Cannot wrap a deleted Y.js value")
  })

  test("throws on destroyed docs", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    doc.destroy()

    expect(() => convertYjsToJsValue(ymap)).toThrow("Cannot wrap a deleted Y.js value")
  })
})
