import { useState, useEffect, useRef } from 'react'
import { getCustomPhotos, getHiddenIds, getCoupsDeCoeur, useStorage } from '../utils/storage'
import { dbGetPhotoLikes, dbLikePhoto, dbUnlikePhoto } from '../utils/db'
import './Portfolio.css'

const categories = ['Portraits & Famille', 'Nature & Paysages', 'Concerts & Événements', 'Auto & Moto', 'Architecture']

// Transforme une URL Cloudinary pour la grille (petite) ou le lightbox (pleine qualité)
function cloudinaryUrl(src, mode = 'thumb') {
  if (!src || !src.includes('cloudinary.com')) return src
  const transform = mode === 'full' ? 'q_auto,f_auto' : 'w_800,q_auto,f_auto'
  return src.replace('/upload/', `/upload/${transform}/`)
}

export default function Portfolio() {
  const [active, setActive]     = useState(categories[0])
  const [lightbox, setLightbox] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [carouselIdx, setCarouselIdx] = useState(0)
  const lightboxRef = useRef(null)
  const masonryRef  = useRef(null)
  const carouselRef = useRef(null)

  const [likes, setLikes] = useState({})
  const [likedByMe, setLikedByMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem('yenou_likes') || '[]') } catch { return [] }
  })

  useEffect(() => { dbGetPhotoLikes().then(setLikes) }, [])

  const toggleLike = (e, photoId) => {
    e.stopPropagation()
    const id = String(photoId)
    const already = likedByMe.includes(id)
    const newLikedByMe = already ? likedByMe.filter(x => x !== id) : [...likedByMe, id]
    setLikedByMe(newLikedByMe)
    localStorage.setItem('yenou_likes', JSON.stringify(newLikedByMe))
    setLikes(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + (already ? -1 : 1)) }))
    already ? dbUnlikePhoto(id) : dbLikePhoto(id)
  }

  const hiddenIds    = useStorage(getHiddenIds)
  const coupsDeCoeur = useStorage(getCoupsDeCoeur)
  const customPhotos = useStorage(getCustomPhotos)
  const photos   = customPhotos.slice().reverse().filter(p => !hiddenIds.includes(p.id))
  const filtered = photos.filter(p => p.category === active)

  // Scroll reveal avec stagger au changement de filtre
  useEffect(() => {
    const items = masonryRef.current?.querySelectorAll('.portfolio__masonry-item') || []
    items.forEach(el => el.classList.remove('revealed'))
    items.forEach((el, i) => {
      setTimeout(() => el.classList.add('revealed'), i * 80)
    })
    if (carouselRef.current) carouselRef.current.scrollLeft = 0
    setCarouselIdx(0)
  }, [active])

  const onCarouselScroll = () => {
    if (!carouselRef.current) return
    const idx = Math.round(carouselRef.current.scrollLeft / carouselRef.current.clientWidth)
    setCarouselIdx(idx)
  }

  const scrollToIndex = (i) => {
    if (!carouselRef.current) return
    carouselRef.current.scrollTo({ left: i * carouselRef.current.clientWidth, behavior: 'smooth' })
  }

  const navigate = (dir) => {
    const idx = filtered.findIndex(p => p.id === lightbox.id)
    setLightbox(filtered[(idx + dir + filtered.length) % filtered.length])
  }

  // Slideshow plein écran
  const navigateNext = useRef(null)
  navigateNext.current = () => {
    setLightbox(current => {
      if (!current) return current
      const idx = filtered.findIndex(p => p.id === current.id)
      return filtered[(idx + 1 + filtered.length) % filtered.length]
    })
  }

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    const timer = setInterval(() => navigateNext.current?.(), 5000)
    return () => clearInterval(timer)
  }, [isFullscreen])

  useEffect(() => {
    if (!isFullscreen) return
    let timer
    const el = lightboxRef.current
    const show = () => {
      if (el) el.style.cursor = 'default'
      clearTimeout(timer)
      timer = setTimeout(() => { if (el) el.style.cursor = 'none' }, 3000)
    }
    show()
    document.addEventListener('mousemove', show)
    return () => {
      document.removeEventListener('mousemove', show)
      clearTimeout(timer)
      if (el) el.style.cursor = ''
    }
  }, [isFullscreen])

  useEffect(() => {
    const onKey = (e) => {
      if (!lightbox) return
      if (e.key === 'ArrowRight') navigate(1)
      if (e.key === 'ArrowLeft')  navigate(-1)
      if (e.key === 'Escape')     closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const closeLightbox = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    setLightbox(null)
  }

  const toggleFullscreen = (e) => {
    e.stopPropagation()
    if (!document.fullscreenElement) lightboxRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  const touchStart = useRef(null)
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd   = (e) => {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) navigate(diff > 0 ? 1 : -1)
    touchStart.current = null
  }

  return (
    <section id="portfolio" className="portfolio">
      <div className="container">

        <div className="portfolio__header reveal">
          <p className="section-label">Mes réalisations</p>
          <h2 className="section-title">Portfolio</h2>
        </div>

        <div className="portfolio__filters-row reveal" data-delay="1">
          <div className="portfolio__filters">
            {categories.map(cat => (
              <button
                key={cat}
                className={`portfolio__filter ${active === cat ? 'active' : ''}`}
                onClick={() => setActive(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <p className="portfolio__coming-soon">
            <span className="portfolio__coming-soon-icon">✦</span>
            D'autres photos sont en cours d'importation
          </p>
        </div>

        {/* Masonry layout — 3 col desktop, 1 col mobile */}
        <div className="portfolio__masonry" ref={masonryRef}>
          {filtered.map((photo, i) => (
            <div
              key={photo.id}
              className="portfolio__masonry-item"
              onClick={() => setLightbox(photo)}
            >
              <img
                src={cloudinaryUrl(photo.src, 'thumb')}
                alt={photo.alt}
                loading="lazy"
                onError={(e) => { e.target.closest('.portfolio__masonry-item').style.display = 'none' }}
              />
              {coupsDeCoeur.includes(photo.id) && (
                <span className="portfolio__cdc-badge">♥ Coup de cœur</span>
              )}
              <div className="portfolio__item-overlay">
                <div className="portfolio__item-meta">
                  <span className="portfolio__item-alt">{photo.alt}</span>
                </div>
              </div>
              <button
                className={`portfolio__like ${likedByMe.includes(String(photo.id)) ? 'portfolio__like--on' : ''}`}
                onClick={(e) => toggleLike(e, photo.id)}
                aria-label="J'aime"
              >
                <span className="portfolio__like-heart">{likedByMe.includes(String(photo.id)) ? '♥' : '♡'}</span>
                {(likes[String(photo.id)] || 0) > 0 && (
                  <span className="portfolio__like-count">{likes[String(photo.id)]}</span>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Carousel mobile — swipe horizontal */}
        <div className="portfolio__carousel" ref={carouselRef} onScroll={onCarouselScroll}>
          {filtered.map((photo, i) => (
            <div
              key={photo.id}
              className={`portfolio__carousel-item ${i === carouselIdx ? 'portfolio__carousel-item--active' : ''}`}
              onClick={() => setLightbox(photo)}
            >
              <img
                src={cloudinaryUrl(photo.src, 'thumb')}
                alt={photo.alt}
                loading="lazy"
                onError={(e) => { e.target.closest('.portfolio__carousel-item').style.display = 'none' }}
              />
              {coupsDeCoeur.includes(photo.id) && (
                <span className="portfolio__cdc-badge">♥ Coup de cœur</span>
              )}
              <div className="portfolio__carousel-info">
                <span className="portfolio__carousel-alt">{photo.alt}</span>
              </div>
              <button
                className={`portfolio__like ${likedByMe.includes(String(photo.id)) ? 'portfolio__like--on' : ''}`}
                onClick={(e) => toggleLike(e, photo.id)}
                aria-label="J'aime"
              >
                <span className="portfolio__like-heart">{likedByMe.includes(String(photo.id)) ? '♥' : '♡'}</span>
                {(likes[String(photo.id)] || 0) > 0 && (
                  <span className="portfolio__like-count">{likes[String(photo.id)]}</span>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Dots améliorés */}
        <div className="portfolio__dots">
          {filtered.map((_, i) => (
            <button
              key={i}
              className={`portfolio__dot ${i === carouselIdx ? 'portfolio__dot--active' : ''}`}
              onClick={() => scrollToIndex(i)}
              aria-label={`Photo ${i + 1}`}
            />
          ))}
        </div>

      </div>

      {lightbox && (
        <div className="lightbox" ref={lightboxRef} onClick={closeLightbox} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <button className="lightbox__close" onClick={closeLightbox}>✕</button>
          <button className="lightbox__fullscreen" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            )}
          </button>
          <button className="lightbox__prev" onClick={e => { e.stopPropagation(); navigate(-1) }}>‹</button>
          <div className="lightbox__inner" onClick={e => e.stopPropagation()}>
            <img src={cloudinaryUrl(lightbox.src, 'full')} alt={lightbox.alt} />
            <button
              className={`portfolio__like portfolio__like--lb ${likedByMe.includes(String(lightbox.id)) ? 'portfolio__like--on' : ''}`}
              onClick={(e) => toggleLike(e, lightbox.id)}
              aria-label="J'aime"
            >
              <span className="portfolio__like-heart">{likedByMe.includes(String(lightbox.id)) ? '♥' : '♡'}</span>
              {(likes[String(lightbox.id)] || 0) > 0 && (
                <span className="portfolio__like-count">{likes[String(lightbox.id)]}</span>
              )}
            </button>
            <div className="lightbox__info">
              {coupsDeCoeur.includes(lightbox.id) && (
                <span className="lightbox__cdc">♥ Coup de cœur</span>
              )}
              <span className="lightbox__alt">{lightbox.alt}</span>
            </div>
          </div>
          <button className="lightbox__next" onClick={e => { e.stopPropagation(); navigate(1) }}>›</button>
          {isFullscreen && (
            <div className="lightbox__progress" key={lightbox.id}>
              <div className="lightbox__progress-bar" />
            </div>
          )}
          <div className="lightbox__mobile-nav" onClick={e => e.stopPropagation()}>
            <button onClick={() => navigate(-1)}>‹</button>
            <span className="lightbox__counter">
              {filtered.findIndex(p => p.id === lightbox.id) + 1} / {filtered.length}
            </span>
            <button onClick={() => navigate(1)}>›</button>
          </div>
        </div>
      )}
    </section>
  )
}
