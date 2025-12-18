<p align="center">
  <img src="./logo.png" height="128" />
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
    <img src="https://img.shields.io/github/actions/workflow/status/yjs-proxy/main.yml?branch=master&label=CI&logo=github&style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Codecov" href="https://codecov.io/gh/xaviergonz/yjs-proxy">
    <img src="https://img.shields.io/codecov/c/github/yjs-proxy?token=6MLRFUBK8V&label=codecov&logo=codecov&style=for-the-badge&labelColor=333" />
  </a>
</p>

> ### Full documentation can be found on the site:
>
> ## [yjs-proxy.js.org](https://yjs-proxy.js.org)

## Introduction

`yjs-proxy` makes working with Y.js types (Maps, Arrays, etc.) as easy as working with plain JavaScript objects. By using Proxies, it provides a seamless developer experience where you can read and write to your shared data structures using standard object and array syntax, while `yjs-proxy` handles the underlying Y.js operations automatically.

By using `yjs-proxy`, you get:

- **Proxy-based API:** Interact with Y.js types using standard JS object and array syntax.
- **Automatic Synchronization:** Changes made to the proxy are automatically reflected in the underlying Y.js types.
- **Type Safety:** Full TypeScript support for your shared data structures.
- **Lightweight:** Minimal overhead over Y.js.

### Installation

```bash
npm install yjs-proxy
# or
pnpm add yjs-proxy
# or
yarn add yjs-proxy
```

## API Guide

### `wrapYjs(yType)`

Wraps a `Y.Map` or `Y.Array` in a Proxy that behaves like a plain JS object or array.

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

Note: `markAsJs` returns a **deeply frozen** shallow clone of the input value. Any plain objects or arrays retrieved from Yjs that were stored as raw values will also be deeply frozen.

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

### Array Operations

All standard array methods are supported, including mutating ones like `push`, `pop`, `splice`, `sort`, and `reverse`. These are automatically wrapped in a single Yjs transaction.

```typescript
const yarr = wrapYjs<number[]>(ydoc.getArray("myarray"))
yarr.push(1, 2, 3)
yarr.sort() // Mutates the underlying Y.Array in one transaction
```

Non-mutating methods like `map`, `filter`, `toSorted`, etc., return plain JS arrays.



