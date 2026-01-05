<p align="center">
  <img src="./logo.png" height="220" />
</p>
<p align="center">
  <i>The most ergonomic way to work with Yjs. Use shared types as plain JavaScript objects.</i>
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/yjs-proxy">
    <img src="https://img.shields.io/npm/v/yjs-proxy.svg?style=for-the-badge&logo=npm&labelColor=333" />
  </a>
  <a aria-label="License" href="./LICENSE">
    <img src="https://img.shields.io/npm/l/yjs-proxy.svg?style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Types" href="./packages/yjs-proxy/tsconfig.json">
    <img src="https://img.shields.io/npm/types/yjs-proxy.svg?style=for-the-badge&logo=typescript&labelColor=333" />
  </a>
  <br />
  <a aria-label="CI" href="https://github.com/xaviergonz/yjs-proxy/actions/workflows/main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/xaviergonz/yjs-proxy/main.yml?branch=master&label=CI&logo=github&style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Codecov" href="https://codecov.io/gh/xaviergonz/yjs-proxy">
    <img src="https://img.shields.io/codecov/c/github/xaviergonz/yjs-proxy?token=6MLRFUBK8V&label=codecov&logo=codecov&style=for-the-badge&labelColor=333" />
  </a>
</p>

## Why yjs-proxy?

Working with Yjs `Y.Map` and `Y.Array` can be verbose, especially with nested structures. You have to manually use `.set()`, `.get()`, and wrap everything in transactions.

`yjs-proxy` lets you interact with Y.js values using **standard JavaScript syntax**.

### Before (Vanilla Yjs)

```ts
const ymap = doc.getMap("state")
ymap.set("count", 1)
const todos = new Y.Array()
todos.insert(0, [new Y.Map([["text", "buy milk"], ["done", false]])])
ymap.set("todos", todos)
const text = ymap.get("todos").get(0).get("text")
```

### After (yjs-proxy)

```ts
withYjsProxy<{ count: number; todos: { text: string; done: boolean }[] }>(
  doc.getMap("state"),
  (state) => {
    state.count = 1
    state.todos = [{ text: "buy milk", done: false }]

    const text = state.todos[0].text // Full autocompletion!
  }
)
```

## Features

- ✨ **Proxy-based API**: Use `obj.prop = val` and `arr.push(val)` instead of `.set()` and `.insert()`.
- 🌲 **Automatic Nesting**: Plain objects and arrays are automatically converted to nested `Y.Map` and `Y.Array`.
- 🔒 **Type Safe**: Full TypeScript support with deep type inference.
- ⚡ **Automatic Transactions**: Mutations are automatically wrapped in `doc.transact()` if attached to a document.
- �️ **Scoped Proxies**: Proxies are valid only inside the callback, preventing stale references.
- 🚀 **Zero Dependencies**: Lightweight and fast, built on native Proxies.
- 💎 **Opt-out CRDT**: Use `markAsJs()` to store large static objects as raw JSON for performance.

## Contents

- [Installation](#installation)
- [Quickstart](#quickstart)
- [Key concepts](#key-concepts)
- [API reference](#api-reference)
- [Observing Changes](#observing-changes)
- [Gotchas & limitations](#gotchas--limitations)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install yjs-proxy
# or
pnpm add yjs-proxy
# or
yarn add yjs-proxy
```

## Quickstart

```ts
import * as Y from "yjs"
import { withYjsProxy } from "yjs-proxy"

type State = {
  count: number
  todos: { id: string; text: string; done: boolean }[]
}

const doc = new Y.Doc()
const ystate = doc.getMap("state")

withYjsProxy<State>(ystate, (state) => {
  state.count = 1
  state.todos = [{ id: "1", text: "ship it", done: false }]
  state.todos.push({ id: "2", text: "write docs", done: true })

  state.todos[0].done = true
})
```

## Key concepts

- **Scoped proxy access.** `withYjsProxy` provides proxies that are only valid inside the callback. After the callback returns, all proxies are revoked and will throw on access. This prevents stale reference bugs.
- **Only `Y.Map` and `Y.Array` are proxied.** `withYjsProxy` throws if you pass a different type.
- **Plain objects/arrays become CRDTs.** Assigning `{}` or `[]` recursively becomes nested `Y.Map` / `Y.Array`.
- **Existing proxies/Y.js values are integrated.** Assigning a proxy or a `Y.Map`/`Y.Array` will reuse the underlying structure if it's not already part of a document or parent; otherwise, it is automatically cloned.
- **Attached vs Detached mode.** A proxy can be in one of two states:
  - **Attached**: The proxy is linked to a `Y.Doc`. Mutations are automatically wrapped in `doc.transact()` and synced with other clients.
  - **Detached**: The proxy is not linked to a document (e.g., it was just created via `toYjsProxy` or its property was deleted from an attached parent). It operates on a local JSON representation.
- **Seamless Transitions.** When a detached proxy is assigned to an attached one, it automatically "attaches" and syncs its local changes to the document. Conversely, when a property is removed from a document, its proxy becomes "detached" but remains fully functional, preserving its state and identity.
- **Raw values are supported (and frozen).** You can opt out of CRDT conversion for a specific object/array using `markAsJs`.

## API reference

This section documents the public exports from `yjs-proxy`.

### `withYjsProxy(yValue, callback)`

Provides scoped access to Yjs values as proxies. Proxies are only valid inside the callback and are automatically revoked afterwards.

- Reads return proxied nested `Y.Map`/`Y.Array` values.
- Writes convert plain objects/arrays into nested Y.js values.
- Mutations run inside a Yjs transaction when possible.
- After the callback, all proxies are revoked and will throw on access.

```typescript
import * as Y from "yjs"
import { withYjsProxy } from "yjs-proxy"

const ydoc = new Y.Doc()
const ymap = ydoc.getMap("mymap")

withYjsProxy<{ a: number; nested: { b: string } }>(ymap, (js) => {
  // Set values using standard syntax
  js.a = 1
  js.nested = { b: "hello" } // Automatically creates a nested Y.Map

  // Read values
  console.log(js.a) // 1
  console.log(js.nested.b) // "hello"

  // Delete keys
  delete js.a
})

// After the callback, accessing `js` would throw!
```

You can also pass multiple Yjs values as an array:

```typescript
withYjsProxy<[{ a: number }, { b: number }]>([ymap1, ymap2], ([p1, p2]) => {
  p1.a = 1
  p2.b = p1.a
})
```

#### Manual Transaction Mode (Async Support)

Use `transactionMode: 'manual'` for async operations or fine-grained transaction control:

```typescript
await withYjsProxy<State>(ymap, async (state, ctx) => {
  const current = state.count

  const data = await fetchData()

  // Check if external changes invalidated our proxies
  if (ctx.isProxyInvalidated()) {
    throw new Error("State changed while fetching")
  }

  // Optionally batch multiple changes
  ctx.transact(() => {
    state.count = data.newCount
    state.name = data.name
  })
}, { transactionMode: 'manual' })
```

In manual mode:

- Proxies are **not** automatically wrapped in a transaction
- Use `ctx.transact()` to batch changes
- If external Yjs changes occur, proxies are revoked and `ctx.isProxyInvalidated()` returns `true`
- Accessing a revoked proxy throws: `"Proxy invalidated: the underlying Y.Map was modified externally"`

You can provide a custom transaction origin in either mode:

```typescript
withYjsProxy(ymap, (state) => {
  state.count = 1
}, { origin: 'my-custom-origin' })
```

#### Error Rollback

Use `rollbackOnError: true` to automatically revert all changes if an error is thrown:

```typescript
withYjsProxy<State>(ymap, (state) => {
  state.count = 1
  state.items.push({ id: 'new' })

  if (someCondition) {
    throw new Error('Validation failed')
    // All changes above will be rolled back
  }
}, { rollbackOnError: true })
```

This works in both auto and manual modes:

```typescript
await withYjsProxy<State>(ymap, async (state, ctx) => {
  ctx.transact(() => {
    state.count = 999
  })

  await validateWithServer()
  throw new Error('Validation failed')
  // Changes are rolled back
}, { transactionMode: 'manual', rollbackOnError: true })
```

> **Note:** In manual mode, if proxies are invalidated by external changes before the error is thrown, rollback is skipped since the proxies can no longer be used to apply inverse operations.

### `toYjsProxy(value, options?)`

Converts a plain JS object or array into a `yjs-proxy` proxy that starts in **detached mode**.

This is useful for creating state that you intend to attach to a document later, while benefiting from the proxy API immediately.

Options:

- `clone` (boolean, default `true`): If `true`, the input value is deep cloned. If `false`, the input value is used as the initial JSON data, meaning mutations to the proxy while detached will affect the original object.

```typescript
import * as Y from "yjs"
import { toYjsProxy, withYjsProxy } from "yjs-proxy"

const state = toYjsProxy({ count: 0 })
state.count++ // Works in detached mode

const doc = new Y.Doc()
withYjsProxy<{ state: { count: number } }>(doc.getMap(), (root) => {
  root.state = state // Automatically attaches and syncs
})
```

### `toYjs(value)`

Converts a plain JavaScript value (object, array, primitive) into its corresponding Y.js value.

- `toYjs(plainObject)` returns a new `Y.Map`.
- `toYjs(plainArray)` returns a new `Y.Array`.
- If the value is already a Y.js value or a `yjs-proxy` proxy, it throws a failure.

```typescript
import { toYjs } from "yjs-proxy"

const ymap = toYjs({ a: 1 }) // Returns a Y.Map
```

### `unwrapYjs(proxy)`

Retrieves the underlying Yjs Map or Array from a `yjs-proxy` proxy. Throws a `YjsProxyError` if the value is not a proxy.

Note: This function returns `undefined` for proxies that are in "JSON mode" (e.g., detached from a document or created via `toYjsProxy`).

```typescript
import * as Y from "yjs"
import { unwrapYjs, withYjsProxy } from "yjs-proxy"

withYjsProxy<{ a: number }>(doc.getMap(), (js) => {
  const yjsValue = unwrapYjs(js) // Returns Y.Map or Y.Array
})
```

### `isYjsProxy(value)`

Checks if a value is a `yjs-proxy` proxy.

```typescript
import { isYjsProxy } from "yjs-proxy"

isYjsProxy(state) // true
isYjsProxy({})    // false
```

### `markAsJs(value)`

Marks a plain object or array to be stored in Yjs as a raw JSON value, rather than being converted into a `Y.Map` or `Y.Array`. This is useful for data that doesn't need CRDT properties or for performance optimization of large, static data.

Notes:

- `markAsJs` **deeply freezes** the input value.
- Raw objects/arrays retrieved from Yjs are also treated as raw values and **deeply frozen**.
- Circular references in raw objects are unsafe for Yjs synchronization (avoid cycles).

```typescript
import { markAsJs } from "yjs-proxy"

js.metadata = markAsJs({ created: Date.now(), tags: ["a", "b"] })
// js.metadata is now a plain object stored in Yjs, not a Y.Map
```

### `isMarkedAsJs(value)`

Returns `true` if the given value is a "raw" JS object (a plain object or array stored as-is in Yjs).

```typescript
import { isMarkedAsJs } from "yjs-proxy"

isMarkedAsJs(js.metadata) // true
isMarkedAsJs(js.nested)   // false (it's a Y.Map proxy)
```

### `yjsWrapperToJson(proxy)`

Converts a `yjs-proxy` proxy into a plain JSON-compatible object or array by calling the underlying Y.js value's `toJSON()` method.

```typescript
import * as Y from "yjs"
import { yjsWrapperToJson, withYjsProxy } from "yjs-proxy"

withYjsProxy<{ a: number; nested: { b: string } }>(doc.getMap(), (js) => {
  js.a = 1
  js.nested = { b: "hello" }

  const json = yjsWrapperToJson(js)
  console.log(json) // { a: 1, nested: { b: "hello" } }
})
```

### `YjsProxyError`

Some invalid operations throw a `YjsProxyError` (for example, passing unsupported values to `withYjsProxy` / `toYjs` / `yjsWrapperToJson`).

```ts
import { YjsProxyError } from "yjs-proxy"

try {
  // ...
} catch (e) {
  if (e instanceof YjsProxyError) {
    // handle expected yjs-proxy errors
  }
}
```

## Observing Changes

Since `yjs-proxy` uses standard Y.js values under the hood, you can use the native Yjs API to observe changes. Get the underlying `Y.Map` or `Y.Array` directly from the document and use its `observeDeep` method.

```ts
import * as Y from "yjs"
import { withYjsProxy } from "yjs-proxy"

const doc = new Y.Doc()
const yMap = doc.getMap<{ count: number }>("state")

yMap.observeDeep((events) => {
  // Access values via Yjs API in observers
  console.log("State changed!", yMap.get("count"))
})

withYjsProxy<{ count: number }>(yMap, (state) => {
  state.count = 1 // This triggers the observer
})
```

Alternatively, use `unwrapYjs` inside the callback to get the underlying Yjs value:

```ts
import { unwrapYjs, withYjsProxy } from "yjs-proxy"

withYjsProxy<{ count: number }>(doc.getMap("state"), (state) => {
  const yMap = unwrapYjs(state)
  yMap?.observeDeep((events) => {
    // Note: This observer will remain active after the callback,
    // but the proxy will be revoked
  })
})
```

## Gotchas & limitations

While `yjs-proxy` tries to be as transparent as possible, there are some differences compared to plain JavaScript:

### Array gotchas

#### Mutating methods

Mutating methods are applied to Yjs in a single transaction when possible: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`.

#### `undefined` in arrays

Yjs does not support `undefined` values in arrays. When you extend an array (e.g. by setting a distant index or increasing `length`), the resulting "holes" are filled with `null` instead of `undefined`. Similarly, explicitly setting an array index to `undefined` will store it as `null`.

```ts
state.todos = [] // sparse array
state.todos[5] = { text: "buy milk" }
console.log(state.todos[0]) // null (not undefined)
```

#### Array `delete`

Using `delete arr[i]` on a proxied `Y.Array` follows standard JavaScript behavior by not shifting other elements. However, instead of leaving a "hole" (which reads as `undefined`), it replaces the element with `null` because Yjs does not support `undefined` in arrays.

Note that unlike plain JS, `i in arr` will still return `true` after deletion if `i` is within the array's length. Use `splice` if you want to remove the element and shrink the array.

#### Array custom properties

Proxied arrays only support numeric indices and the `length` property. Attempting to set custom properties (e.g., `arr.foo = 123`) will throw a `YjsProxyError`.

#### Non-mutating array methods return snapshots

Methods like `map`, `filter`, `slice`, `toSorted`, etc., return a **plain JS array** snapshot. While the elements themselves remain proxies (if they are nested `Y.Map` or `Y.Array`), the returned array is no longer "live"—mutating it (e.g., via `push`) will not affect the underlying Yjs state.

### Object gotchas

#### Identity mismatch (but aliased mutations)

When you assign a plain object or array to a property, it is converted into a `Y.Map` or `Y.Array` and then wrapped in a Proxy. This means the value you read back is **not** the same instance you assigned.

```ts
const obj = { x: 1 }
state.a = obj
console.log(state.a === obj) // false
```

However, if you assign the same value (or an existing proxy) to multiple locations, they become **aliased**—mutations to one will propagate to all others:

```ts
const obj = { x: 1 }
state.a = obj
state.b = obj // Same object assigned again

state.a.x = 10
console.log(state.b.x) // 10 — automatically synced!

// Also works with existing proxies:
state.c = state.a
state.c.x = 20
console.log(state.a.x) // 20
console.log(state.b.x) // 20
```

To check if two proxies are aliased, use `areAliased`:

```ts
import { areAliased } from "yjs-proxy"

console.log(areAliased(state.a, state.b)) // true
```

> **Note:** Aliasing only works within the same `Y.Doc`. Assigning a value to a different document creates an independent clone.

#### Only plain objects and arrays are supported

Only plain objects (those with `Object.prototype` or `null` as their prototype) and arrays are supported for automatic conversion to `Y.Map` and `Y.Array`.

Attempting to assign other types of objects (like class instances, `Map`, `Set`, etc.) will throw a `YjsProxyError`. If you need to store such objects, you must either convert them to plain objects first or use `markAsJs` to store them as raw data.

`Uint8Array` and other Y.js values (like `Y.Text`, `Y.XmlFragment`, etc.) are also supported as they are natively handled by Yjs.

#### Map proxies have `null` prototype

A wrapped `Y.Map` proxy is created with `Object.create(null)` and its `getPrototypeOf()` returns `null`. This means `value instanceof Object` will be `false` for these proxies.

#### Symbol keys are not supported

Only string keys are supported for objects (`Y.Map`). Attempting to use `Symbol` keys will throw a `YjsProxyError`.

### Other gotchas

#### Cyclic structures

Yjs does not support cyclic structures. Attempting to assign an object with circular references will throw an error.

#### Raw values are frozen

Objects marked with `markAsJs` are **deeply frozen**. Any attempt to mutate them will throw an error in strict mode.

```ts
const raw = markAsJs({ a: 1 })
state.raw = raw
state.raw.a = 2 // Throws!
```

#### `Object.defineProperty` limitations

Proxies only support value-based property definitions. Attempting to define accessors (getters/setters) or non-value descriptors will fail.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT. See [LICENSE](./LICENSE).
