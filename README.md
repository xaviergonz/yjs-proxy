<p align="center">
  <img src="./logo.png" height="220" />
  <h1 align="center">yjs-proxy</h1>
</p>
<p align="center">
  <i>Use Y.js types as if they were plain JavaScript objects using Proxies</i>
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

## Introduction

`yjs-proxy` makes working with Yjs shared types feel like working with plain JavaScript objects.

It wraps `Y.Map` and `Y.Array` in Proxies so you can read/write shared state using normal property access and array methods, while the library translates those operations into Yjs updates.

Highlights:

- **Proxy-based API:** Use standard object/array syntax with Yjs types.
- **Automatic nesting:** Assigning plain objects/arrays creates nested `Y.Map` / `Y.Array` structures.
- **Raw values (opt-in):** Store plain objects/arrays as-is via `markAsJs` (useful for static data).

## Contents

- [Installation](#installation)
- [Quickstart](#quickstart)
- [Key concepts](#key-concepts)
- [API reference](#api-reference)
- [Array behavior](#array-behavior)
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
import { wrapYjs } from "yjs-proxy"

type State = {
  count: number
  todos: { id: string; text: string; done: boolean }[]
}

const doc = new Y.Doc()
const ystate = doc.getMap("state")

const state = wrapYjs<State>(ystate)

state.count = 1
state.todos = [{ id: "1", text: "ship it", done: false }]
state.todos.push({ id: "2", text: "write docs", done: true })

state.todos[0].done = true
```

## Key concepts

- **Only `Y.Map` and `Y.Array` are proxied.** `wrapYjs` throws if you pass a different type.
- **Plain objects/arrays become CRDTs.** Assigning `{}` or `[]` recursively becomes nested `Y.Map` / `Y.Array`.
- **Existing proxies/Yjs types are integrated.** Assigning a `wrapYjs` proxy or a `Y.Map`/`Y.Array` will reuse the underlying structure if it's not already part of a document or parent; otherwise, it is automatically cloned.
- **Transactions are automatic when attached to a doc.** If the wrapped type is attached to a `Y.Doc`, mutations are wrapped in `doc.transact()`.
- **Raw values are supported (and frozen).** You can opt out of CRDT conversion for a specific object/array using `markAsJs`.

## API reference

This section documents the public exports from `yjs-proxy`.

### `wrapYjs(yType)`

Wraps a `Y.Map` or `Y.Array` in a Proxy that behaves like a plain JS object or array.

- Reads return proxied nested `Y.Map`/`Y.Array` values.
- Writes convert plain objects/arrays into nested Yjs types.
- Mutations run inside a Yjs transaction when possible.

```typescript
import * as Y from "yjs"
import { wrapYjs } from "yjs-proxy"

const ydoc = new Y.Doc()
const ymap = ydoc.getMap("mymap")
const js = wrapYjs<{ a: number; nested: { b: string } }>(ymap)

// Set values using standard syntax
js.a = 1
js.nested = { b: "hello" } // Automatically creates a nested Y.Map

// Read values
console.log(js.a) // 1
console.log(js.nested.b) // "hello"

// Delete keys
delete js.a
```

### `toYjs(value)`

Converts a plain JS object/array into a Yjs-backed structure, or unwraps an existing proxy back to its underlying Yjs type.

- `toYjs(wrapYjsProxy)` returns the underlying `Y.Map` / `Y.Array`.
- `toYjs(plainObject)` returns a new `Y.Map`.
- `toYjs(plainArray)` returns a new `Y.Array`.

```typescript
import { toYjs } from "yjs-proxy"

const ymap = toYjs({ a: 1 }) // Returns a Y.Map
const unwrapped = toYjs(js) // Returns the original Y.Map/Y.Array
```

### `unwrapYjs(proxy)`

Retrieves the underlying Yjs Map or Array from a `wrapYjs` proxy. Returns `undefined` if the value is not a proxy.

```typescript
import { unwrapYjs } from "yjs-proxy"

const yType = unwrapYjs(js) // Returns Y.Map or Y.Array
```

### `markAsJs(value)`

Marks a plain object or array to be stored in Yjs as a raw JSON value, rather than being converted into a `Y.Map` or `Y.Array`. This is useful for data that doesn't need CRDT properties or for performance optimization of large, static data.

Notes:

- `markAsJs` returns a **deeply frozen** shallow clone of the input value. Note that because it is a shallow clone, any nested objects/arrays in the original value will also be frozen.
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

Converts a `wrapYjs` proxy into a plain JSON-compatible object or array by calling the underlying Yjs type's `toJSON()` method.

```typescript
import { yjsWrapperToJson } from "yjs-proxy"

const json = yjsWrapperToJson(js)
console.log(json) // { a: 1, nested: { b: "hello" } }
```

### `YjsProxyError`

Some invalid operations throw a `YjsProxyError` (for example, passing unsupported values to `wrapYjs` / `toYjs` / `yjsWrapperToJson`).

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

## Array behavior

`wrapYjs(Y.Array)` aims to feel like a normal JS array, but there are a few important details:

- **Mutating methods are applied to Yjs** in a single transaction when possible: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`.
- **Non-mutating methods** (like `map`, `filter`, `slice`, `toSorted`, etc.) operate on a snapshot and return a plain JS array (though elements will still be proxies if they are nested `Y.Map` or `Y.Array`).
- **`undefined` is not representable in Yjs.** When you extend an array by setting `length` or writing past the end, missing entries are filled with `null`.
- **`delete arr[i]` does not shrink the array.** It replaces the slot with `null` (preserving array length). Note that `null` is not a true JS "hole", so `i in arr` will still be `true`.

## Gotchas & limitations

- **Cyclic structures are not supported.** Assigning cyclic plain objects/arrays will throw.
- **Raw values are immutable (frozen).** Anything stored or returned as a raw object/array is deeply frozen; treat it as read-only.
- **Only plain objects become `Y.Map`.** Objects that are not plain (e.g. class instances) are stored as raw JSON data. They lose their prototype and methods when retrieved from the shared state.
- **Prefer plain JSON-ish data.** For shared state, stick to primitives, plain objects, plain arrays, and Yjs types.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT. See [LICENSE](./LICENSE).
