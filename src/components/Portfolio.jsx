import { useState, useEffect, useRef } from 'react'
import { getCustomPhotos, getHiddenIds, useStorage } from '../utils/storage'
import { dbGetPhotoLikes, dbLikePhoto, dbUnlikePhoto } from '../utils/db'
import './Portfolio.css'

const categories = ['Tous', 'Portraits & Famille', 'Nature & Paysages', 'Concerts & Événements']

const defaultPhotos = [
  { id: 1, src: '/images/portfolio/portrait1.jpg', category: 'Portraits & Famille', alt: 'Portrait', exif: { a: 'f/1.8', s: '1/250s', i: 'ISO 200', f: '85mm' } },
  { id: 2, src: '/images/portfolio/portrait2.jpg', category: 'Portraits & Famille', alt: 'Portrait famille', exif: { a: 'f/2.8', s: '1/160s', i: 'ISO 400', f: '50mm' } },
  { id: 3, src: '/images/portfolio/portrait3.jpg', category: 'Portraits & Famille', alt: 'Portrait individuel', exif: { a: 'f/1.4', s: '1/500s', i: 'ISO 100', f: '85mm' } },
  { id: 4, src: '/images/portfolio/nature1.jpg',   category: 'Nature & Paysages',   alt: 'Paysage',          exif: { a: 'f/8',   s: '1/125s', i: 'ISO 100', f: '24mm' } },
  { id: 5, src: '/images/portfolio/nature2.jpg',   category: 'Nature & Paysages',   alt: 'Forêt des Vosges', exif: { a: 'f/5.6', s: '1/60s',  i: 'ISO 200', f: '35mm' } },
  { id: 6, src: '/images/portfolio/nature3.jpg',   category: 'Nature & Paysages',   alt: 'Lac de Contrex',   exif: { a: 'f/11',  s: '1/250s', i: 'ISO 100', f: '16mm' } },
  { id: 7, src: '/images/portfolio/concert1.jpg',  category: 'Concerts & Événements', alt: 'Concert',        exif: { a: 'f/2.8', s: '1/500s', i: 'ISO 3200', f: '70mm' } },
  { id: 8, src: '/images/portfolio/concert2.jpg',  category: 'Concerts & Événements', alt: 'Événement live', exif: { a: 'f/2.8', s: '1/320s', i: 'ISO 1600', f: '135mm' } },
  { id: 9, src: '/images/portfolio/concert3.jpg',  category: 'Concerts & Événements', alt: 'Concert ambiance', exif: { a: 'f/4', s: '1/250s', i: 'ISO 800', f: '50mm' } },
]

export default function Portfolio() {
  const [active, setActive] = useState('Tous')
  const [lightbox, setLightbox] = useState(null)
  const [carouselIdx, setCarouselIdx] = useState(0)
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
  const customPhotos = useStorage(getCustomPhotos)
  const photos = [...customPhotos.slice().reverse(), ...defaultPhotos].filter(p => !hiddenIds.includes(p.id))

  const filtered = active === 'Tous' ? photos : photos.filter(p => p.category === active)

  // Re-déclenche les animations après changement de filtre
  useEffect(() => {
    const items = document.querySelectorAll('.portfolio__item.reveal')
    items.forEach((el, i) => {
      el.classList.remove('revealed')
      setTimeout(() => el.classList.add('revealed'), i * 60)
    })
    // Reset carousel position
    if (carouselRef.current) carouselRef.current.scrollLeft = 0
    setCarouselIdx(0)
  }, [active])

  const navigate = (dir) => {
    const idx = filtered.findIndex(p => p.id === lightbox.id)
    setLightbox(filtered[(idx + dir + filtered.length) % filtered.length])
  }

  const onCarouselScroll = () => {
    if (!carouselRef.current) return
    const idx = Math.round(carouselRef.current.scrollLeft / carouselRef.current.clientWidth)
    setCarouselIdx(idx)
  }

  // Swipe mobile (lightbox)
  const touchStart = useRef(null)
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
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

        <div className="portfolio__filters reveal" data-delay="1">
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

        {/* Grille desktop */}
        <div className="portfolio__grid">
          {filtered.map((photo, i) => (
            <div
              key={photo.id}
              className={`portfolio__item ${i === 0 ? 'portfolio__item--large' : 'reveal'}`}
              data-delay={String(Math.min(i % 3 + 1, 4))}
              onClick={() => setLightbox(photo)}
            >
              <img src={photo.src} alt={photo.alt} loading="lazy"
                onError={(e) => { e.target.parentElement.classList.add('portfolio__item--empty'); e.target.style.display = 'none' }}
              />
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

        {/* Carousel mobile */}
        <div className="portfolio__carousel" ref={carouselRef} onScroll={onCarouselScroll}>
          {filtered.map((photo) => (
            <div key={photo.id} className="portfolio__carousel-item" onClick={() => setLightbox(photo)}>
              <img src={photo.src} alt={photo.alt} loading="lazy"
                onError={(e) => { e.target.parentElement.classList.add('portfolio__item--empty'); e.target.style.display = 'none' }}
              />
              <div className="portfolio__carousel-info">
                <span className="portfolio__carousel-alt">{photo.alt}</span>
                <span className="portfolio__carousel-cat">{photo.category}</span>
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
        <div className="portfolio__dots">
          {filtered.map((_, i) => (
            <div key={i} className={`portfolio__dot ${i === carouselIdx ? 'portfolio__dot--active' : ''}`} />
          ))}
        </div>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <button className="lightbox__close" onClick={() => setLightbox(null)}>✕</button>
          <button className="lightbox__prev" onClick={e => { e.stopPropagation(); navigate(-1) }}>‹</button>
          <div className="lightbox__inner" onClick={e => e.stopPropagation()}>
            <img src={lightbox.src} alt={lightbox.alt} />
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
              <span className="lightbox__alt">{lightbox.alt}</span>
            </div>
          </div>
          <button className="lightbox__next" onClick={e => { e.stopPropagation(); navigate(1) }}>›</button>
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
