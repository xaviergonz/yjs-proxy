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

Core package:

> `npm install pojo-yjs yjs`

> `yarn add pojo-yjs yjs`

> `pnpm add pojo-yjs yjs`

For Y.js integration (optional):



