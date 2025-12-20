import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { unwrapYjs } from "../src/unwrapYjs"
import { wrapYjs } from "../src/wrapYjs"

describe("nested detachment", () => {
  test("nested proxies are switched to json mode when detached", () => {
    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap()) as any

    // 1. Create a nested structure
    root.o = { a: { b: { c: 3 } } }

    const o = root.o
    const a = o.a
    const b = a.b

    // Verify they are currently Yjs proxies
    expect(unwrapYjs(o)).toBeDefined()
    expect(unwrapYjs(a)).toBeDefined()
    expect(unwrapYjs(b)).toBeDefined()
    expect(b.c).toBe(3)

    // 2. Detach the parent from the root
    root.o = undefined

    // 3. Verify 'o' is now in JSON mode
    expect(unwrapYjs(o)).toBeUndefined()
    expect(o.a).toBe(a) // Identity should be preserved

    // 4. Verify 'a' and 'b' are now in JSON mode and still work
    expect(unwrapYjs(a)).toBeUndefined()
    expect(unwrapYjs(b)).toBeUndefined()
    expect(a.b).toBe(b)
    expect(b.c).toBe(3)

    // 5. Verify we can still mutate it in JSON mode
    b.c = 4
    expect(b.c).toBe(4)

    // 6. Reattach
    root.o2 = o
    expect(unwrapYjs(o)).toBeDefined()
    expect(unwrapYjs(a)).toBeDefined()
    expect(unwrapYjs(b)).toBeDefined()
    expect(b.c).toBe(4)
    expect((doc.getMap().get("o2") as Y.Map<any>).get("a").get("b").get("c")).toBe(4)
  })

  test("nested proxies in arrays are switched to json mode when detached", () => {
    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap()) as any

    root.arr = [{ x: { y: 1 } }]
    const item = root.arr[0]
    const nested = item.x

    expect(unwrapYjs(item)).toBeDefined()
    expect(unwrapYjs(nested)).toBeDefined()

    // Detach via array mutation
    root.arr.pop()

    expect(unwrapYjs(item)).toBeUndefined()
    expect(unwrapYjs(nested)).toBeUndefined()
    expect(nested.y).toBe(1)

    item.x.y = 2
    expect(nested.y).toBe(2)

    // Reattach
    root.arr.push(item)
    expect(unwrapYjs(item)).toBeDefined()
    expect(unwrapYjs(nested)).toBeDefined()
    expect(nested.y).toBe(2)
    expect((doc.getMap().get("arr") as Y.Array<any>).get(0).get("x").get("y")).toBe(2)
  })
})
