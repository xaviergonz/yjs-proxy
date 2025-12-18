/**
 * A pojo-yjs error.
 */
export class PojoYjsError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, PojoYjsError.prototype)
  }
}
