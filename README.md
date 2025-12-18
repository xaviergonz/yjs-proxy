<p align="center">
  <img src="./logo.png" height="128" />
  <h1 align="center">pojo-yjs</h1>
</p>
<p align="center">
  <i>Use Y.js types as if they were plain JavaScript objects using Proxies</i>
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/pojo-yjs">
    <img src="https://img.shields.io/npm/v/pojo-yjs.svg?style=for-the-badge&logo=npm&labelColor=333" />
  </a>
  <a aria-label="License" href="./LICENSE">
    <img src="https://img.shields.io/npm/l/pojo-yjs.svg?style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Types" href="./packages/pojo-yjs/tsconfig.json">
    <img src="https://img.shields.io/npm/types/pojo-yjs.svg?style=for-the-badge&logo=typescript&labelColor=333" />
  </a>
  <br />
  <a aria-label="CI" href="https://github.com/xaviergonz/pojo-yjs/actions/workflows/main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/xaviergonz/pojo-yjs/main.yml?branch=master&label=CI&logo=github&style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Codecov" href="https://codecov.io/gh/xaviergonz/pojo-yjs">
    <img src="https://img.shields.io/codecov/c/github/xaviergonz/pojo-yjs?token=6MLRFUBK8V&label=codecov&logo=codecov&style=for-the-badge&labelColor=333" />
  </a>
</p>

> ### Full documentation can be found on the site:
>
> ## [pojo-yjs.js.org](https://pojo-yjs.js.org)

## Introduction

`pojo-yjs` makes working with Y.js types (Maps, Arrays, etc.) as easy as working with plain JavaScript objects. By using Proxies, it provides a seamless developer experience where you can read and write to your shared data structures using standard object and array syntax, while `pojo-yjs` handles the underlying Y.js operations automatically.

By using `pojo-yjs`, you get:

- **Proxy-based API:** Interact with Y.js types using standard JS object and array syntax.
- **Automatic Synchronization:** Changes made to the proxy are automatically reflected in the underlying Y.js types.
- **Type Safety:** Full TypeScript support for your shared data structures.
- **Lightweight:** Minimal overhead over Y.js.

### Installation

```bash
npm install pojo-yjs yjs
# or
pnpm add pojo-yjs yjs
# or
yarn add pojo-yjs yjs
```

## API Guide

### `yjsAsPojo(yType)`

Wraps a `Y.Map` or `Y.Array` in a Proxy that behaves like a plain JS object or array.

```typescript
import * as Y from "yjs"
import { yjsAsPojo } from "pojo-yjs"

const ydoc = new Y.Doc()
const ymap = ydoc.getMap("mymap")
const pojo = yjsAsPojo<{ a: number; nested: { b: string } }>(ymap)

// Set values using standard syntax
pojo.a = 1
pojo.nested = { b: "hello" } // Automatically creates a nested Y.Map

// Read values
console.log(pojo.a) // 1
console.log(pojo.nested.b) // "hello"

// Delete keys
delete pojo.a
```

### `pojoToYjs(value)`

Converts a plain JS object/array into a Yjs-backed structure, or unwraps an existing proxy back to its underlying Yjs type.

```typescript
import { pojoToYjs } from "pojo-yjs"

const ymap = pojoToYjs({ a: 1 }) // Returns a Y.Map
const unwrapped = pojoToYjs(pojo) // Returns the original Y.Map/Y.Array
```

### `getYjsForPojo(proxy)`

Retrieves the underlying Yjs Map or Array from a `yjsAsPojo` proxy. Returns `undefined` if the value is not a proxy.

```typescript
import { getYjsForPojo } from "pojo-yjs"

const yType = getYjsForPojo(pojo) // Returns Y.Map or Y.Array
```

### `rawPojo(value)`

Marks a plain object or array to be stored in Yjs as a raw JSON value, rather than being converted into a `Y.Map` or `Y.Array`. This is useful for data that doesn't need CRDT properties or for performance optimization of large, static data.

Note: `rawPojo` returns a **deeply frozen** shallow clone of the input value. Any plain objects or arrays retrieved from Yjs that were stored as raw values will also be deeply frozen.

```typescript
import { rawPojo } from "pojo-yjs"

pojo.metadata = rawPojo({ created: Date.now(), tags: ["a", "b"] })
// pojo.metadata is now a plain object stored in Yjs, not a Y.Map
```

### `isRawPojo(value)`

Returns `true` if the given value is a "raw" POJO (a plain object or array stored as-is in Yjs).

```typescript
import { isRawPojo } from "pojo-yjs"

isRawPojo(pojo.metadata) // true
isRawPojo(pojo.nested)   // false (it's a Y.Map proxy)
```

### `pojoToJson(proxy)`

Converts a `yjsAsPojo` proxy into a plain JSON-compatible object or array by calling the underlying Yjs type's `toJSON()` method.

```typescript
import { pojoToJson } from "pojo-yjs"

const json = pojoToJson(pojo)
console.log(json) // { a: 1, nested: { b: "hello" } }
```

### `rawPojo(value)`

Marks a plain object or array to be stored in Yjs as a raw JSON value instead of being converted into a `Y.Map` or `Y.Array`.

```typescript
import { rawPojo, yjsAsPojo } from "pojo-yjs"

const pojo = yjsAsPojo(ydoc.getMap())
pojo.config = rawPojo({ theme: "dark" }) // Stored as a raw JS object in Yjs
```

### Array Operations

All standard array methods are supported, including mutating ones like `push`, `pop`, `splice`, `sort`, and `reverse`. These are automatically wrapped in a single Yjs transaction.

```typescript
const yarr = yjsAsPojo<number[]>(ydoc.getArray("myarray"))
yarr.push(1, 2, 3)
yarr.sort() // Mutates the underlying Y.Array in one transaction
```

Non-mutating methods like `map`, `filter`, `toSorted`, etc., return plain JS arrays.



