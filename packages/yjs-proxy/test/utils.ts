import { afterEach } from "vitest"

export type Dispose = () => void

const disposers: Dispose[] = []

afterEach(() => {
  disposers.forEach((d) => {
    d()
  })
  disposers.length = 0
})

export function autoDispose(disposer: Dispose) {
  disposers.push(disposer)
}
