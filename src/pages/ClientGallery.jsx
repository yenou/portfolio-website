import { useEffect, useState, useRef } from 'react'
import { dbGetGallery, dbIncrementGalleryView } from '../utils/db'
import { getLogoImg } from '../utils/storage'
import './ClientGallery.css'

export default function ClientGallery() {
  const code = window.location.pathname.split('/galerie/')[1]?.toUpperCase()
  const [gallery, setGallery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('cg_' + code) === '1')
  const [pwdInput, setPwdInput] = useState('')
  const [pwdError, setPwdError] = useState(false)
  const logoImg = getLogoImg()
  const touchStart = useRef(null)

  useEffect(() => {
    if (!code) { setLoading(false); return }
    dbGetGallery(code).then(g => {
      setGallery(g)
      setLoading(false)
      if (g && (!g.password || unlocked)) dbIncrementGalleryView(code)
    })
  }, [code])

  const submitPassword = () => {
    if (pwdInput.toUpperCase() === gallery.password) {
      sessionStorage.setItem('cg_' + code, '1')
      setUnlocked(true)
      dbIncrementGalleryView(code)
    } else {
      setPwdError(true)
      setTimeout(() => setPwdError(false), 1500)
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (lightbox === null) return
      if (e.key === 'ArrowRight') setLightbox(i => (i + 1) % gallery.photos.length)
      if (e.key === 'ArrowLeft')  setLightbox(i => (i - 1 + gallery.photos.length) % gallery.photos.length)
      if (e.key === 'Escape')     setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, gallery])

  const navigate = (dir) => {
    if (!gallery) return
    setLightbox(i => (i + dir + gallery.photos.length) % gallery.photos.length)
  }

  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) navigate(diff > 0 ? 1 : -1)
    touchStart.current = null
  }

  if (loading) return (
    <div className="cg cg--loading">
      <div className="cg__spinner" />
    </div>
  )

  if (gallery && gallery.password && !unlocked) return (
    <div className="cg cg--locked">
      <div className="cg__lock-box">
        <div className="cg__lock-icon">🔒</div>
        <p className="cg__lock-label">Galerie privée</p>
        <h1 className="cg__lock-name">{gallery.clientName}</h1>
        <p className="cg__lock-hint">Entrez le code d'accès transmis par votre photographe</p>
        <div className={`cg__lock-form ${pwdError ? 'cg__lock-form--error' : ''}`}>
          <input
            className="cg__lock-input"
            type="text"
            placeholder="Code d'accès"
            value={pwdInput}
            onChange={e => setPwdInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submitPassword()}
            maxLength={6}
            autoFocus
          />
          <button className="cg__lock-btn" onClick={submitPassword}>Accéder →</button>
        </div>
        {pwdError && <p className="cg__lock-error">Code incorrect</p>}
        <a href="/" className="cg__back" style={{ marginTop: '24px' }}>← Retour au site</a>
      </div>
    </div>
  )

  if (!gallery) return (
    <div className="cg cg--notfound">
      <div className="cg__notfound-inner">
        <p className="cg__notfound-code">404</p>
        <h1>Galerie introuvable</h1>
        <p>Ce lien n'existe pas ou a été supprimé.</p>
        <a href="/" className="cg__back">← Retour au site</a>
      </div>
    </div>
  )

  return (
    <div className="cg">
      <header className="cg__header">
        <div className="cg__header-inner">
          <a href="/" className="cg__brand">
            {logoImg
              ? <img src={logoImg} alt="Logo" className="cg__logo" />
              : <span className="cg__logo-text">YENOU André</span>
            }
          </a>
          <div className="cg__title-wrap">
            <p className="cg__label">Galerie privée</p>
            <h1 className="cg__client-name">{gallery.clientName}</h1>
          </div>
          <div className="cg__code-badge">
            <span className="cg__code-label">Code</span>
            <span className="cg__code-value">{gallery.code}</span>
          </div>
        </div>
      </header>

      <main className="cg__main">
        {gallery.photos.length === 0 ? (
          <div className="cg__empty">
            <p>Aucune photo pour le moment.</p>
            <p>Revenez bientôt !</p>
          </div>
        ) : (
          <div className="cg__grid">
            {gallery.photos.map((photo, i) => (
              <div key={photo.id} className="cg__item" onClick={() => setLightbox(i)}>
                <img src={photo.src} alt={photo.caption || `Photo ${i + 1}`} loading="lazy" />
                <div className="cg__watermark" aria-hidden="true">
                  <span>© YENOU André Photographie</span>
                  <span>© YENOU André Photographie</span>
                  <span>© YENOU André Photographie</span>
                </div>
                {photo.caption && <span className="cg__caption">{photo.caption}</span>}
              </div>
            ))}
          </div>
        )}
      </main>

      {lightbox !== null && (
        <div className="cg__lightbox" onClick={() => setLightbox(null)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <button className="cg__lb-close" onClick={() => setLightbox(null)}>×</button>
          <button className="cg__lb-prev" onClick={e => { e.stopPropagation(); navigate(-1) }}>‹</button>
          <div className="cg__lb-wrap" onClick={e => e.stopPropagation()}>
            <img
              src={gallery.photos[lightbox].src}
              alt={gallery.photos[lightbox].caption || ''}
              className="cg__lb-img"
            />
            <div className="cg__lb-watermark" aria-hidden="true">
              <span>© YENOU André Photographie</span>
              <span>© YENOU André Photographie</span>
              <span>© YENOU André Photographie</span>
              <span>© YENOU André Photographie</span>
              <span>© YENOU André Photographie</span>
            </div>
          </div>
          <button className="cg__lb-next" onClick={e => { e.stopPropagation(); navigate(1) }}>›</button>
          <span className="cg__lb-counter">{lightbox + 1} / {gallery.photos.length}</span>
        </div>
      )}

      <footer className="cg__footer">
        <p>© {new Date().getFullYear()} YENOU André Photographie — Galerie privée · Lien confidentiel</p>
      </footer>
    </div>
  )
}
