import { PojoYjsError } from "./PojoYjsError"

export function failure(msg: string) {
  return new PojoYjsError(msg)
}
