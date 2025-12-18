import * as Y from "yjs"
import { PojoProxy } from "./types"

export const yjsToProxyCache = new WeakMap<Y.Map<any> | Y.Array<any>, PojoProxy>()
export const proxyToYjsCache = new WeakMap<object, Y.Map<any> | Y.Array<any>>()
export const rawPojos = new WeakSet<object>()
