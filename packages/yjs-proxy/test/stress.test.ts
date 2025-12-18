import { describe, expect, test } from "vitest"
import * as Y from "yjs"
import { wrapYjs, yjsWrapperToJson } from "../src/index"

describe("stress tests", () => {
  test("complex nested operations and consistency", () => {
    const doc = new Y.Doc()
    const ymap = doc.getMap("m")
    const proxy = wrapYjs<any>(ymap)
    let shadow: any = {}

    const apply = (fn: (obj: any) => void) => {
      fn(proxy)
      fn(shadow)
      // Yjs toJSON converts undefined/holes to null, so we normalize shadow
      const normalizedShadow = JSON.parse(
        JSON.stringify(shadow, (_key, value) => (value === undefined ? null : value))
      )
      expect(yjsWrapperToJson(proxy)).toEqual(normalizedShadow)
      shadow = normalizedShadow
    }

    // Initial nested structure
    apply((obj) => {
      obj.root = {
        a: 1,
        b: [1, 2, { c: 3 }],
        d: {
          e: "hello",
          f: { g: 4 },
        },
      }
    })

    // Array operations
    apply((obj) => {
      obj.root.b.push(4)
      obj.root.b.unshift(0)
      obj.root.b.splice(2, 1, "replaced")
    })

    // Object property deletion and updates
    apply((obj) => {
      delete obj.root.d.e
      obj.root.d.f.h = 5
      obj.root.a = { new: "object" }
    })

    // Spreading (Object)
    apply((obj) => {
      obj.root.d = { ...obj.root.d, extra: "data", f: { ...obj.root.d.f, i: 6 } }
    })

    // Spreading (Array)
    apply((obj) => {
      obj.root.b = [...obj.root.b, 5, 6]
    })

    // Copying nodes around (using spreading to ensure it's a copy in both JS and Yjs)
    apply((obj) => {
      // Copying a sub-object to another location
      obj.root.copy = { ...obj.root.d.f }
      // Copying a sub-array to another location
      obj.root.arrayCopy = [...obj.root.b]
    })

    // Deeply nested updates on copied nodes
    apply((obj) => {
      obj.root.copy.newProp = "changed"
    })

    // Plain objects (treated as JS in shadow, converted in proxy)
    apply((obj) => {
      obj.root.plain = { some: "data" }
    })

    // Empty objects and arrays
    apply((obj) => {
      obj.root.empty = {}
      obj.root.emptyArray = []
      obj.root.d.emptyNested = []
    })

    // Complex array manipulations
    apply((obj) => {
      obj.root.b.reverse()
      obj.root.numbers = [5, 2, 8, 1]
    })

    apply((obj) => {
      obj.root.numbers.sort((a: number, b: number) => a - b)
    })

    // Multiple levels of nesting
    apply((obj) => {
      obj.root.deep = { level1: { level2: { level3: "end" } } }
      obj.root.deep.level1.level2.level3 = { ...obj.root.copy }
    })

    // Direct assignment (reference in JS, clone in Yjs)
    // They match immediately after assignment
    apply((obj) => {
      obj.root.direct = obj.root.d.f
    })

    // Deleting from array using length
    apply((obj) => {
      obj.root.numbers.length = 2
    })

    // Setting array index beyond length
    apply((obj) => {
      obj.root.numbers[5] = 100
    })

    // Null and boolean values
    apply((obj) => {
      obj.root.nullValue = null
      obj.root.booleans = { t: true, f: false }
      obj.root.b.push(null, true, false)
    })

    // Nested array in object in array
    apply((obj) => {
      obj.root.b[3] = { nested: [7, 8, 9] }
    })

    // Object.assign
    apply((obj) => {
      Object.assign(obj.root.d, { assigned: "value", another: { x: 1 } })
    })

    // String edge cases
    apply((obj) => {
      obj.root.strings = {
        empty: "",
        spaces: "   ",
        unicode: "🚀 Hello 世界",
      }
    })

    // Moving objects from one node to another
    apply((obj) => {
      obj.root.moved = obj.root.d.another
      delete obj.root.d.another
    })

    // Replacing array properties with their filter
    apply((obj) => {
      obj.root.numbers = obj.root.numbers.filter((n: any) => n !== null && n > 5)
    })

    // Changing arrays by doing length 0 and then pushing some items
    apply((obj) => {
      obj.root.b.length = 0
      obj.root.b.push("new", "items", { after: "clear" })
    })

    // Replacing an object with a new one that contains the old one
    apply((obj) => {
      obj.root.a = { nested: obj.root.a }
    })

    // Nested array manipulations (pop/shift)
    apply((obj) => {
      obj.root.b[2].after = "modified"
      const popped = obj.root.b.pop()
      obj.root.lastPopped = popped
    })

    // Using delete on array indices (creates holes/nulls)
    apply((obj) => {
      obj.root.numbers = [10, 20, 30, 40]
    })
    apply((obj) => {
      delete obj.root.numbers[1]
    })

    // Circular-like but not circular (diamond shape)
    apply((obj) => {
      const shared = { shared: "data" }
      obj.root.left = { ref: shared }
      obj.root.right = { ref: shared }
    })

    // Deeply nested delete
    apply((obj) => {
      delete obj.root.deep.level1.level2.level3
    })

    // Array splice with many arguments
    apply((obj) => {
      obj.root.b.splice(1, 1, "a", "b", { c: "d" }, [1, 2])
    })

    // Using Object.keys and iterating
    apply((obj) => {
      for (const key of Object.keys(obj.root.d)) {
        obj.root.d[key + "_suffix"] = obj.root.d[key]
      }
    })

    // Nested array sort
    apply((obj) => {
      obj.root.b[4] = [4, 3, 2, 1]
      obj.root.b[4].sort()
    })

    // Re-assigning a sub-tree to a new location and then modifying it
    apply((obj) => {
      obj.root.newLocation = { ...obj.root.d }
      obj.root.newLocation.extra = "modified after move"
    })

    // Complex splice that removes and adds at the same time
    apply((obj) => {
      obj.root.b.splice(0, 2, { x: 1 }, { y: 2 })
    })

    // Object.defineProperties (if supported by proxy)
    apply((obj) => {
      Object.defineProperty(obj.root.d, "defined", {
        value: { nested: "value" },
        enumerable: true,
        configurable: true,
        writable: true,
      })
    })

    // Deeply nested Object.assign
    apply((obj) => {
      Object.assign(obj.root.deep.level1, {
        newProp: "added",
        another: [10, 20],
      })
    })

    // Filtering an array in-place (using splice)
    apply((obj) => {
      const toRemove: number[] = []
      obj.root.numbers.forEach((n: any, i: number) => {
        if (n === null || n < 50) toRemove.push(i)
      })
      for (let i = toRemove.length - 1; i >= 0; i--) {
        obj.root.numbers.splice(toRemove[i], 1)
      }
    })

    // Moving a node and then deleting its original parent
    apply((obj) => {
      obj.root.finalMove = { ...obj.root.deep }
      delete obj.root.deep
    })

    // Moving a node correctly (assign then delete)
    apply((obj) => {
      obj.root.revived = obj.root.finalMove
      delete obj.root.finalMove
    })

    // Array.from
    apply((obj) => {
      obj.root.fromArray = Array.from(obj.root.b)
    })

    // Nested Object.assign with proxy as source
    apply((obj) => {
      obj.root.assignedFromProxy = {}
      Object.assign(obj.root.assignedFromProxy, obj.root.d)
    })

    // Deeply nested array of objects manipulation
    apply((obj) => {
      obj.root.complexArray = [{ id: 1 }, { id: 2 }]
      obj.root.complexArray[0].data = { x: 10 }
      obj.root.complexArray.push({ id: 3, data: { y: 20 } })
      obj.root.complexArray.splice(1, 1, { id: 4 })
    })

    // Swap two array elements using splice (safe for moves)
    apply((obj) => {
      if (obj.root.b.length >= 2) {
        const val0 = obj.root.b[0]
        const val1 = obj.root.b[1]
        obj.root.b.splice(0, 2, val1, val0)
      }
    })

    // Move nested object from one array to another
    apply((obj) => {
      if (obj.root.b.length > 0 && obj.root.numbers) {
        const item = obj.root.b.pop()
        obj.root.numbers.push(item)
      }
    })

    // Deeply nested spread with property deletion
    apply((obj) => {
      obj.root.deep = { ...obj.root.revived, newProp: "added", level1: undefined }
      delete obj.root.deep.level1
    })

    // Array fill with objects
    apply((obj) => {
      if (obj.root.numbers.length > 2) {
        obj.root.numbers.fill({ filled: true }, 0, 2)
      }
    })

    // Array copyWithin
    apply((obj) => {
      if (obj.root.numbers.length >= 4) {
        obj.root.numbers.copyWithin(0, 2, 4)
      }
    })

    // Reverse nested array
    apply((obj) => {
      if (obj.root.complexArray && Array.isArray(obj.root.complexArray)) {
        obj.root.complexArray.reverse()
      }
    })

    // Sort nested array
    apply((obj) => {
      if (obj.root.complexArray && Array.isArray(obj.root.complexArray)) {
        obj.root.complexArray.sort((a: any, b: any) => (a.id || 0) - (b.id || 0))
      }
    })

    // Replace a whole branch with a subset of itself
    apply((obj) => {
      obj.root.revived = obj.root.revived?.level1 || obj.root.revived
    })

    // Circular-like move (swap)
    apply((obj) => {
      const a = obj.root.b
      const b = obj.root.numbers
      if (a && b) {
        // Use a temporary property to keep 'a' alive while we overwrite 'b'
        obj.root.temp = a
        obj.root.b = b
        obj.root.numbers = obj.root.temp
        delete obj.root.temp
      }
    })

    // Large scale splice
    apply((obj) => {
      obj.root.b.splice(0, obj.root.b.length, { a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }, { e: 5 })
    })
  })
})
