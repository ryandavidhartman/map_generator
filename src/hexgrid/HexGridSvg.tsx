import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useMapDispatch, useMapState } from '../state/MapContext'
import { isRevealableNow } from '../state/mapReducer'
import { axialToPixel, hexesInRadius, hexId } from './hexMath'
import { HexTile } from './HexTile'

const HEX_SIZE = 40

type ViewBox = { x: number; y: number; w: number; h: number }

function computeFitViewBox(radius: number, size: number): ViewBox {
  const coords = hexesInRadius(radius)
  const points = coords.map((c) => axialToPixel(c, size))
  const pad = size * 1.4
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs) - pad
  const maxX = Math.max(...xs) + pad
  const minY = Math.min(...ys) - pad
  const maxY = Math.max(...ys) + pad
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function HexGridSvg() {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const svgRef = useRef<SVGSVGElement>(null)
  const dragOrigin = useRef<{ x: number; y: number } | null>(null)
  const fitViewBox = useMemo(() => computeFitViewBox(state.radius, HEX_SIZE), [state.radius])
  const [viewBox, setViewBox] = useState<ViewBox>(fitViewBox)

  useEffect(() => {
    setViewBox(fitViewBox)
  }, [fitViewBox])

  const coords = useMemo(() => hexesInRadius(state.radius), [state.radius])

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    dragOrigin.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!dragOrigin.current || !svgRef.current) return
    const dx = e.clientX - dragOrigin.current.x
    const dy = e.clientY - dragOrigin.current.y
    dragOrigin.current = { x: e.clientX, y: e.clientY }
    const rect = svgRef.current.getBoundingClientRect()
    setViewBox((vb) => ({
      ...vb,
      x: vb.x - (dx / rect.width) * vb.w,
      y: vb.y - (dy / rect.height) * vb.h,
    }))
  }

  function handlePointerUp() {
    dragOrigin.current = null
  }

  // React attaches onWheel as a passive listener, which silently ignores
  // preventDefault. Use a native listener so scroll-to-zoom doesn't also
  // scroll the page.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    function handleWheelNative(e: globalThis.WheelEvent) {
      e.preventDefault()
      const rect = svg!.getBoundingClientRect()
      const mouseXRatio = (e.clientX - rect.left) / rect.width
      const mouseYRatio = (e.clientY - rect.top) / rect.height
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1

      setViewBox((vb) => {
        const minW = fitViewBox.w * 0.2
        const maxW = fitViewBox.w * 1.5
        const newW = Math.min(maxW, Math.max(minW, vb.w * factor))
        const scale = newW / vb.w
        const newH = vb.h * scale
        const dw = vb.w - newW
        const dh = vb.h - newH
        return {
          x: vb.x + dw * mouseXRatio,
          y: vb.y + dh * mouseYRatio,
          w: newW,
          h: newH,
        }
      })
    }

    svg.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheelNative)
  }, [fitViewBox])

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ width: '100%', height: '100%', background: '#0d0d0d', touchAction: 'none' }}
    >
      {coords.map((coord) => {
        const id = hexId(coord)
        const hex = state.hexes[id]
        return (
          <HexTile
            key={id}
            coord={coord}
            size={HEX_SIZE}
            hex={hex}
            isParty={state.partyHexId === id}
            isSelected={state.selectedHexId === id}
            isRevealable={isRevealableNow(state, id)}
            onClick={() => {
              if (hex) {
                dispatch({ type: 'SELECT_HEX', hexId: id })
              } else if (isRevealableNow(state, id)) {
                dispatch({ type: 'MOVE_PARTY_TO', hexId: id })
              }
            }}
          />
        )
      })}
    </svg>
  )
}
