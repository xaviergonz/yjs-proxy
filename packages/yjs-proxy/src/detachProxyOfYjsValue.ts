import * as Y from "yjs"
import { dataToProxyCache, setProxyState, tryGetProxyState } from "./cache"
import { getProxyAliasSiblings, linkProxyAliases } from "./sharedRefs"
import type { YjsProxy } from "./types"

/**
 * Detaches a proxy from its Y.js value by creating a JSON representation of its current state.
 * This should be called before the Y.js value is deleted or detached from its document.
 *
 * @param yjsValue The Y.js value to detach the proxy from.
 * @returns The proxy associated with the Y.js value, if any.
 */
export function detachProxyOfYjsValue(yjsValue: unknown): object | undefined {
  if (!(yjsValue instanceof Y.AbstractType)) return undefined
  detachProxyOfYjsValueAndGetJSON(yjsValue)
  return dataToProxyCache.get(yjsValue)
}

function detachProxyOfYjsValueAndGetJSON(yjsValue: Y.AbstractType<any>): object {
  const proxy = dataToProxyCache.get(yjsValue)
  if (proxy) {
    const state = tryGetProxyState(proxy)
    if (state && !state.attached) {
      // JSON representation already exists
      return state.json
    }
  }

  if (!yjsValue.doc) {
    throw new Error(
      "Cannot create JSON representation for a Y.js value that is not attached to a document"
    )
  }

  // Check if any proxy alias sibling is already detached with shared JSON we can reuse
  let sharedJson: object | undefined
  let sharedJsonProxy: YjsProxy | undefined
  if (proxy) {
    for (const siblingProxy of getProxyAliasSiblings(proxy)) {
      const siblingState = tryGetProxyState(siblingProxy)
      if (siblingState && !siblingState.attached) {
        sharedJson = siblingState.json
        sharedJsonProxy = siblingProxy
        break
      }
    }
  }

  let json: any
  if (sharedJson) {
    // Reuse the shared JSON from an already-detached alias sibling
    json = sharedJson
  } else if (yjsValue instanceof Y.Map) {
    json = {}
    for (const [key, value] of yjsValue.entries()) {
      json[key] = value instanceof Y.AbstractType ? detachProxyOfYjsValueAndGetJSON(value) : value
    }
  } else if (yjsValue instanceof Y.Array) {
    json = yjsValue
      .toArray()
      .map((value) =>
        value instanceof Y.AbstractType ? detachProxyOfYjsValueAndGetJSON(value) : value
      )
  } else {
    // Fallback for Y.Text, Y.Xml, etc.
    json = yjsValue.toJSON()
  }

  if (proxy) {
    setProxyState(proxy, { attached: false, json })
    dataToProxyCache.set(json, proxy)

    // Link proxies at the proxy level for areAliased to work
    if (sharedJsonProxy) {
      linkProxyAliases(proxy, sharedJsonProxy)
    }
  }

  return json
}
