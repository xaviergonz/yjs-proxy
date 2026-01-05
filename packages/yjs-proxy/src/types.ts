import * as Y from "yjs"

export type StringKeyedObject = Record<string, any>

export type YjsProxy = object

/**
 * A Yjs value that can be proxied (Y.Map or Y.Array).
 */
export type YjsProxiableValue = Y.Map<any> | Y.Array<any>
