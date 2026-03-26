import { useState, useEffect } from 'react'
import { getBanner, useStorage } from '../utils/storage'
import './Banner.css'

export default function Banner() {
  const banner = useStorage(getBanner)
  const [dismissed, setDismissed] = useState(false)

  const visible = banner.enabled && !dismissed && banner.text.trim() !== ''

  useEffect(() => {
    document.documentElement.style.setProperty('--banner-h', visible ? '42px' : '0px')
    return () => document.documentElement.style.setProperty('--banner-h', '0px')
  }, [visible])

  if (!visible) return null

  return (
    <div className="banner">
      <span className="banner__text">
        {banner.text}
        {banner.link && (
          <a href={banner.link} target="_blank" rel="noreferrer" className="banner__link">
            {banner.linkLabel || 'En savoir plus'}
          </a>
        )}
      </span>
      <button className="banner__close" onClick={() => setDismissed(true)} aria-label="Fermer">×</button>
    </div>
  )
}
