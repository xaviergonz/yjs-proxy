# Changelog

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
