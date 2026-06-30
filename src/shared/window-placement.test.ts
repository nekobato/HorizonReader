import { describe, expect, it } from 'vitest'

import { calculateControllerPlacement } from './window-placement'

describe('calculateControllerPlacement', () => {
  const workArea = { x: 0, y: 0, width: 1440, height: 900 }
  const controllerSize = { width: 640, height: 76 }

  it('places the controller below Main when the lower gap is larger', () => {
    expect(
      calculateControllerPlacement(
        { x: 400, y: 80, width: 800, height: 32 },
        controllerSize,
        workArea
      )
    ).toEqual({ x: 560, y: 120, width: 640, height: 76 })
  })

  it('places the controller above Main when the upper gap is larger', () => {
    expect(
      calculateControllerPlacement(
        { x: 400, y: 760, width: 800, height: 32 },
        controllerSize,
        workArea
      )
    ).toEqual({ x: 560, y: 676, width: 640, height: 76 })
  })

  it('clamps the controller inside the work area', () => {
    expect(
      calculateControllerPlacement(
        { x: 20, y: 760, width: 400, height: 32 },
        controllerSize,
        workArea
      )
    ).toEqual({ x: 0, y: 676, width: 640, height: 76 })
  })
})
