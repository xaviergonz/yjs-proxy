/**
 * A yjs-proxy error.
 */
export class YjsProxyError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, YjsProxyError.prototype)
  }
}
