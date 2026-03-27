import { useEffect, useRef, useState } from 'react'
import './Hero.css'
import { getTexts, getHeroImg, getHeroImgs, useStorage } from '../utils/storage'

const INTERVAL = 10000
const TRANSITION = 1200

export default function Hero() {
  const bgRef    = useRef(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const texts    = useStorage(getTexts)
  const heroImg  = useStorage(getHeroImg)
  const heroImgs = useStorage(getHeroImgs)

  // Normalize slides: support both string (legacy) and object format
  const rawSlides = heroImgs.length > 0 ? heroImgs : (heroImg ? [heroImg] : [])
  const slides = rawSlides.length > 0
    ? rawSlides.map(s => typeof s === 'string' ? { src: s, location: 'Contrexéville', sub: 'Vosges, France' } : s)
    : [{ src: '/images/hero.jpg', location: 'Contrexéville', sub: 'Vosges, France' }]

  const [badgeVisible, setBadgeVisible] = useState(true)

  const [current, setCurrent]   = useState(0)
  const [prev, setPrev]         = useState(null)
  const [transitioning, setTransitioning] = useState(false)

  // Slideshow timer
  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => {
      setCurrent(c => {
        setPrev(c)
        setTransitioning(true)
        const next = (c + 1) % slides.length
        setTimeout(() => { setPrev(null); setTransitioning(false) }, TRANSITION)
        return next
      })
    }, INTERVAL)
    return () => clearInterval(t)
  }, [slides.length])

  // Reset to slide 0 if slides change
  useEffect(() => { setCurrent(0); setPrev(null) }, [slides.length])

  // Mouse parallax + scroll parallax on bg container
  useEffect(() => {
    const update = () => {
      if (!bgRef.current) return
      const { x, y } = mouseRef.current
      bgRef.current.style.transform =
        `translate(${x}px, ${window.scrollY * 0.25 + y}px) scale(1.08)`
    }
    const onScroll    = () => update()
    const onMouseMove = (e) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth  - 0.5) * 18,
        y: (e.clientY / window.innerHeight - 0.5) * 10,
      }
      update()
    }
    window.addEventListener('scroll',    onScroll,    { passive: true })
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    return () => {
      window.removeEventListener('scroll',    onScroll)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  // Fade badge out then in on slide change
  useEffect(() => {
    setBadgeVisible(false)
    const t = setTimeout(() => setBadgeVisible(true), 400)
    return () => clearTimeout(t)
  }, [current])

  const goTo = (i) => {
    if (i === current || transitioning) return
    setPrev(current)
    setTransitioning(true)
    setCurrent(i)
    setTimeout(() => { setPrev(null); setTransitioning(false) }, TRANSITION)
  }

  return (
    <section id="accueil" className="hero">
      {/* Background slideshow */}
      <div className="hero__bg" ref={bgRef}>
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className={`hero__slide ${i === current ? 'hero__slide--active' : ''} ${i === prev ? 'hero__slide--prev' : ''}`}
            style={{ backgroundImage: `url(${slide.src})`, backgroundPosition: `center ${slide.posY ?? 50}%`, backgroundSize: slide.scale != null ? `${slide.scale}%` : 'cover' }}
          />
        ))}
        <div className="hero__overlay" />
        <div className="hero__scan" />
      </div>

      {/* Location badge — per slide */}
      {slides[current]?.location && (
        <div className={`hero__location ${badgeVisible ? 'hero__location--visible' : ''}`}>
          <svg className="hero__location-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          <span className="hero__location-text">{slides[current].location}</span>
          {slides[current].sub && <>
            <span className="hero__location-sep">·</span>
            <span className="hero__location-sub">{slides[current].sub}</span>
          </>}
        </div>
      )}

      {/* Main content — bloc unique centré */}
      <div className="hero__content">

        <span className="hero__top-label">— 2026 —</span>

        <div className="hero__title-wrap">
          <h2 className="hero__portfolio-title">Portfolio</h2>
        </div>

        <p className="hero__top-sub">Lumière · Instant · Émotion</p>

        <div className="hero__divider">
          <span className="hero__divider-line" />
          <span className="hero__divider-dot" />
          <span className="hero__divider-line" />
        </div>

        <div className="hero__eyebrow">
          <span>{texts.heroEyebrow}</span>
        </div>

        <div className="hero__title-wrap">
          <h1 className="hero__title">YENOU André</h1>
        </div>

        <div className="hero__subtitle-wrap">
          <p className="hero__subtitle">Photographie basé sur Contrexéville</p>
        </div>

        <p className="hero__tagline">{texts.heroTagline}</p>

        <div className="hero__cta">
          <a href="#portfolio" className="btn btn--solid">
            <span>Découvrir</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
          <a href="#contact" className="btn btn--ghost">Me contacter</a>
        </div>
      </div>

      {/* Slideshow indicators */}
      {slides.length > 1 && (
        <div className="hero__indicators">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`hero__indicator ${i === current ? 'hero__indicator--active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Photo ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* EXIF */}
      <div className="hero__exif">
        <span>85mm</span><span className="hero__exif-sep">·</span>
        <span>f/1.8</span><span className="hero__exif-sep">·</span>
        <span>1/500s</span><span className="hero__exif-sep">·</span>
        <span>ISO 400</span>
      </div>

      {/* Scroll indicator */}
      <a href="#portfolio" className="hero__scroll">
        <span className="hero__scroll-track"><span className="hero__scroll-thumb" /></span>
        <span>Défiler</span>
      </a>
    </section>
  )
}
