import * as Y from "yjs"
import { YjsProxy } from "./types"

export const yjsToProxyCache = new WeakMap<Y.Map<any> | Y.Array<any>, YjsProxy>()
export const proxyToYjsCache = new WeakMap<object, Y.Map<any> | Y.Array<any>>()
export const markedAsJsValues = new WeakSet<object>()
