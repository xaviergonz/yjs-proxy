import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import { toYjs, wrapYjs, yjsWrapperToJson } from "../src"

describe("proxied object lifecycle", () => {
  it("should support the user's detachment use case", () => {
    const doc = new Y.Doc()
    const proxiedObj = wrapYjs(doc.getMap("root"))

    // 1. proxiedObj.prop = {a:1}
    proxiedObj.prop = { a: 1 }

    // 2. const tempObj = proxiedObj.prop
    const tempObj = proxiedObj.prop
    expect(tempObj.a).toBe(1)

    // 3. proxiedObj.prop = undefined
    // This should trigger detachment of tempObj
    proxiedObj.prop = undefined

    // 4. tempObj.a === 1
    expect(tempObj.a).toBe(1)

    // 5. tempObj.a++
    tempObj.a++

    // 6. tempObj.a === 2
    expect(tempObj.a).toBe(2)

    // 7. proxiedObj.prop = tempObj
    // This should re-attach and sync the JSON data
    proxiedObj.prop = tempObj

    // 8. tempObj.a === 2
    expect(tempObj.a).toBe(2)
    expect(proxiedObj.prop.a).toBe(2)
    expect(proxiedObj.prop === tempObj).toBe(true)
  })

  it("should check behavior when assigned and then unassigned from a doc", () => {
    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap("root"))

    // 1. Create a proxied object (unattached)
    const o = { a: 1 }
    const ymap = toYjs(o)
    const wrappedO = wrapYjs(ymap as Y.Map<any>)

    // 2. Assign it to the root (attached)
    root.x = wrappedO

    // Verify it works while attached
    expect(root.x.a).toBe(1)
    expect(wrappedO.a).toBe(1)
    expect(yjsWrapperToJson(wrappedO)).toEqual({ a: 1 })
    expect(root.x === wrappedO).toBe(true)

    // 3. Unassign it
    delete root.x

    // 4. Check behavior after unassigning
    expect(wrappedO.a).toBe(1)
    expect(yjsWrapperToJson(wrappedO)).toEqual({ a: 1 })

    wrappedO.a = 2
    expect(wrappedO.a).toBe(2)
    expect(yjsWrapperToJson(wrappedO)).toEqual({ a: 2 })

    // 5. Try to write to it
    wrappedO.a = 2
    expect(wrappedO.a).toBe(2)

    // Re-attach
    const rootProxy = wrapYjs(doc.getMap())
    rootProxy.o = wrappedO
    expect(doc.getMap().get("o")).toBeInstanceOf(Y.Map)
    expect((doc.getMap().get("o") as Y.Map<{ a: number }>).toJSON()).toEqual({ a: 2 })
    expect(wrappedO.a).toBe(2)
  })

  it("should support detachment for arrays", () => {
    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap())
    root.arr = [1, 2, 3]

    const arrProxy = root.arr
    expect(arrProxy).toHaveLength(3)

    // Detach
    root.arr = undefined
    expect(arrProxy).toHaveLength(3)
    expect(arrProxy[0]).toBe(1)

    // Modify while detached
    arrProxy.push(4)
    arrProxy[0] = 0
    expect(arrProxy).toHaveLength(4)
    expect(arrProxy[0]).toBe(0)
    expect(arrProxy[3]).toBe(4)

    // Re-attach
    root.arr = arrProxy
    expect(doc.getMap().get("arr")).toBeInstanceOf(Y.Array)
    expect((doc.getMap().get("arr") as Y.Array<number>).toJSON()).toEqual([0, 2, 3, 4])
    expect(arrProxy[0]).toBe(0)
  })

  it("should support detachment for nested objects", () => {
    const doc = new Y.Doc()
    const root = wrapYjs(doc.getMap())
    root.o = { a: { b: 1 } }

    const oProxy = root.o
    const aProxy = oProxy.a

    // Detach
    root.o = undefined

    expect(oProxy.a.b).toBe(1)
    expect(aProxy.b).toBe(1)

    // Modify nested while detached
    aProxy.b = 2
    expect(oProxy.a.b).toBe(2)
    expect(aProxy.b).toBe(2)

    // Re-attach
    root.o = oProxy
    expect((doc.getMap().get("o") as Y.Map<{ a: Y.Map<{ b: number }> }>).toJSON()).toEqual({
      a: { b: 2 },
    })
  })
})
