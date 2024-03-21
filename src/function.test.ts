import { describe, expect, it } from 'vitest'
import { mapOver } from './function'

describe('mapOver', () => {
  it('maps a function over a map', () => {
    const map = new Map<string, number>([
      ['1', 1]
    ])

    const result = mapOver(map)(([k, v]) => [k, `${v}`])

    expect(result).toBeDefined()
    expect(result[0][1]).toBeTypeOf('string')

  })
})
