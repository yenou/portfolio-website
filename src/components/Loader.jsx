import { useEffect, useState } from 'react'
import './Loader.css'

export default function Loader({ onDone, syncDone }) {
  const [animDone, setAnimDone] = useState(false)
  const [exiting, setExiting]   = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimDone(true), 1200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!animDone || !syncDone) return
    setExiting(true)
    const t = setTimeout(onDone, 700)
    return () => clearTimeout(t)
  }, [animDone, syncDone, onDone])

  return (
    <div className={`loader ${exiting ? 'loader--exit' : ''}`}>
      <div className="loader__viewfinder">
        <svg viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" stroke="white" strokeWidth="0.5" strokeDasharray="4 4" className="loader__circle-dash" />
          <circle cx="60" cy="60" r="35" stroke="white" strokeWidth="0.5" className="loader__circle-solid" />
          <line x1="60" y1="10" x2="60" y2="30" stroke="white" strokeWidth="0.5" />
          <line x1="60" y1="90" x2="60" y2="110" stroke="white" strokeWidth="0.5" />
          <line x1="10" y1="60" x2="30" y2="60" stroke="white" strokeWidth="0.5" />
          <line x1="90" y1="60" x2="110" y2="60" stroke="white" strokeWidth="0.5" />
          <circle cx="60" cy="60" r="3" fill="white" className="loader__dot" />
        </svg>
      </div>
      <div className="loader__text">
        <p className="loader__name">YENOU André</p>
        <p className="loader__sub">Photographie</p>
      </div>
      <div className="loader__progress">
        <div className="loader__bar" />
      </div>
      <p className="loader__location">Contrexéville · Vosges</p>
    </div>
  )
}
