# Changelog

## 2.1.0

### New Features

- **Manual transaction mode**: `withYjsProxy` now supports `transactionMode: 'manual'` for async callbacks and fine-grained transaction control.
  - Async callbacks are supported
  - External Yjs changes automatically revoke proxies
  - `ctx.isProxyInvalidated()` to check if proxies were invalidated
  - `ctx.transact()` to batch changes
  - Optional custom `origin` for transaction tracking (also available in auto mode)

## 2.0.0

### Breaking Changes

- **New scoped proxy API**: Replaced `wrapYjs` with `withYjsProxy`. Proxies are now only valid inside the callback scope and are automatically revoked afterwards, preventing stale reference bugs.
- `wrapYjs` is no longer exported from the public API. Use `withYjsProxy` instead.

### New Features

- **`withYjsProxy(yValue, callback)`**: Provides scoped access to Yjs values as proxies. Supports both single values and arrays of values.
- **Native proxy revocation**: Uses JavaScript's built-in `Proxy.revocable()` for clean proxy invalidation after scope ends.
- **Automatic transaction wrapping**: All mutations within a `withYjsProxy` callback are wrapped in Yjs transactions per document.

### Migration

```ts
// Before (1.x)
const state = wrapYjs<State>(ymap)
state.count = 1

// After (2.0)
withYjsProxy<State>(ymap, (state) => {
  state.count = 1
})
```

## 1.2.0

- **Aliasing support**: When the same plain JS object or existing proxy is assigned to multiple locations, they become aliases. Mutations to one automatically propagate to all others within the same `Y.Doc`.
- Added `areAliased(a, b)` function to check if two proxies are aliased.
- Aliasing persists across attach/detach cycles - detached aliased proxies share the same underlying JSON and stay in sync.

## 1.1.0

- Proxies can now be in attached or detached mode. In attached mode the proxies back an active Y.js value, while in detached mode they back a plain JS object/array. This is because Y.js values can be written, but they cannot be read / transformed to JSON while detached.

## 1.0.4

- Updated readme.

## 1.0.3

- `markAsJs` now freezes the passed object instead of shallow copying it.
- Non-plain objects (like class instances) now throw a `YjsProxyError` when assigned, instead of being stored as raw JSON data and losing their prototype.
- Setting custom properties on arrays or symbol keys on objects now throws a `YjsProxyError`.

## 1.0.2

- Several binding fixes.

## 1.0.1

- Update logo.

## 1.0.0

- Initial release.
