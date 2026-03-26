import { useEffect, useRef } from 'react'
import './Cursor.css'

export default function Cursor() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)

  useEffect(() => {
    if (window.innerWidth < 1024) return
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let mouseX = -200, mouseY = -200
    let ringX = -200, ringY = -200
    let frame

    const onMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
      dot.style.left = `${mouseX}px`
      dot.style.top = `${mouseY}px`
      dot.style.opacity = '1'
      ring.style.opacity = '1'
    }

    const loop = () => {
      ringX += (mouseX - ringX) * 0.1
      ringY += (mouseY - ringY) * 0.1
      ring.style.left = `${ringX}px`
      ring.style.top = `${ringY}px`
      frame = requestAnimationFrame(loop)
    }

    const onOver = (e) => {
      const isInteractive = e.target.closest('a, button')
      dot.classList.toggle('cursor--hover', !!isInteractive)
      ring.classList.toggle('cursor--hover', !!isInteractive)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)
    frame = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}
