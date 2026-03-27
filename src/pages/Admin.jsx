import { useState, useRef, useEffect } from 'react'
import {
  getCustomPhotos, saveCustomPhotos, getHiddenIds, saveHiddenIds,
  getHeroImg, getHeroImgs, saveHeroImgs, getAboutImg, saveAboutImg, getLogoImg, saveLogoImg,
  getTexts, saveTexts,
  getTestimonials, saveTestimonials,
  getServices, saveServices,
  getContact, saveContact,
  getPassword, savePassword,
  getBanner, saveBanner,
  updateLastActive,
} from '../utils/storage'
import './Admin.css'
import { dbSaveConfig, dbSaveAboutImg, dbSaveLogoImg, dbSaveCustomPhoto, dbDeleteCustomPhoto, dbSaveAllHeroSlides, dbGetVisitHistory, dbCreateGallery, dbDeleteGallery, dbAddGalleryPhoto, dbDeleteGalleryPhoto, dbGetAllGalleries } from '../utils/db'

const CATEGORIES = ['Portraits & Famille', 'Nature & Paysages', 'Concerts & Événements']

// Compresse une image base64 via canvas (max 1600px, qualité 82%)
function compressImage(base64, maxW = 1600, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width  * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = base64
  })
}

// Supprime automatiquement le fond d'un logo (détecte la couleur du coin et efface les pixels proches)
// Protège les cas où le logo est de la même couleur que le fond (logo blanc sur blanc, etc.)
function removeBackground(base64, tolerance = 40) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const total = data.length / 4

      // Si l'image a déjà de la transparence → retourner tel quel
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 200) { resolve(base64); return }
      }

      // Moyenne des 4 coins pour détecter la couleur de fond
      const w = canvas.width, h = canvas.height
      const corners = [[0,0],[w-1,0],[0,h-1],[w-1,h-1]]
      let rSum=0, gSum=0, bSum=0
      corners.forEach(([cx,cy]) => {
        const idx = (cy * w + cx) * 4
        rSum += data[idx]; gSum += data[idx+1]; bSum += data[idx+2]
      })
      const bgR = rSum/4, bgG = gSum/4, bgB = bSum/4

      // Compte les pixels qui seraient supprimés
      let removeCount = 0
      for (let i = 0; i < data.length; i += 4) {
        const diff = Math.sqrt((data[i]-bgR)**2 + (data[i+1]-bgG)**2 + (data[i+2]-bgB)**2)
        if (diff < tolerance) removeCount++
      }
      // Si >85% des pixels correspondent au fond → le logo EST cette couleur, ne pas modifier
      if (removeCount / total > 0.85) { resolve(base64); return }

      // Supprime les pixels proches du fond
      for (let i = 0; i < data.length; i += 4) {
        const diff = Math.sqrt((data[i]-bgR)**2 + (data[i+1]-bgG)**2 + (data[i+2]-bgB)**2)
        if (diff < tolerance) data[i+3] = 0
      }
      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = base64
  })
}

const DEFAULT_PHOTOS = [
  { id: 1,  src: '/images/portfolio/portrait1.jpg', category: 'Portraits & Famille',   alt: 'Portrait',           isDefault: true },
  { id: 2,  src: '/images/portfolio/portrait2.jpg', category: 'Portraits & Famille',   alt: 'Portrait famille',   isDefault: true },
  { id: 3,  src: '/images/portfolio/portrait3.jpg', category: 'Portraits & Famille',   alt: 'Portrait individuel',isDefault: true },
  { id: 4,  src: '/images/portfolio/nature1.jpg',   category: 'Nature & Paysages',     alt: 'Paysage',            isDefault: true },
  { id: 5,  src: '/images/portfolio/nature2.jpg',   category: 'Nature & Paysages',     alt: 'Forêt des Vosges',   isDefault: true },
  { id: 6,  src: '/images/portfolio/nature3.jpg',   category: 'Nature & Paysages',     alt: 'Lac de Contrex',     isDefault: true },
  { id: 7,  src: '/images/portfolio/concert1.jpg',  category: 'Concerts & Événements', alt: 'Concert',            isDefault: true },
  { id: 8,  src: '/images/portfolio/concert2.jpg',  category: 'Concerts & Événements', alt: 'Événement live',     isDefault: true },
  { id: 9,  src: '/images/portfolio/concert3.jpg',  category: 'Concerts & Événements', alt: 'Concert ambiance',   isDefault: true },
]

// ── Auto-logout hook ──────────────────────────────────────────────────────────
function useAutoLogout(timeoutMinutes, onLogout) {
  useEffect(() => {
    if (!timeoutMinutes) return
    const ms = timeoutMinutes * 60 * 1000
    let timer = setTimeout(onLogout, ms)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(onLogout, ms)
      updateLastActive()
    }
    window.addEventListener('mousemove', reset)
    window.addEventListener('keydown', reset)
    window.addEventListener('click', reset)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('keydown', reset)
      window.removeEventListener('click', reset)
    }
  }, [timeoutMinutes, onLogout])
}

// ── File picker helper ────────────────────────────────────────────────────────
function useFilePicker(onResult) {
  const ref = useRef(null)
  const open = () => ref.current?.click()
  const onChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => compressImage(ev.target.result).then(onResult)
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const Input = () => <input ref={ref} type="file" accept="image/*" onChange={onChange} style={{ display: 'none' }} />
  return { open, Input }
}

// ── SAVED BADGE ───────────────────────────────────────────────────────────────
function SavedBadge({ show }) {
  if (!show) return null
  return <span className="admin-saved">✓ Sauvegardé</span>
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Admin({ onExit }) {
  const [auth, setAuth]       = useState(false)
  const [pwd, setPwd]         = useState('')
  const [pwdError, setPwdError] = useState(false)
  const [tab, setTab]         = useState('dashboard')
  const [autoLogoutMin, setAutoLogoutMin] = useState(30)

  useAutoLogout(auth ? autoLogoutMin : 0, () => setAuth(false))

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = (e) => {
    e.preventDefault()
    if (pwd === getPassword()) { setAuth(true); setPwdError(false) }
    else setPwdError(true)
  }

  if (!auth) return (
    <div className="admin-login">
      <div className="admin-login__box">
        <div className="admin-login__icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h1 className="admin-login__title">Administration</h1>
        <p className="admin-login__sub">YENOU André Photographie</p>
        <form onSubmit={handleLogin} className="admin-login__form">
          <input type="password" placeholder="Mot de passe" value={pwd}
            onChange={e => { setPwd(e.target.value); setPwdError(false) }}
            className={`admin-login__input ${pwdError ? 'error' : ''}`} autoFocus />
          {pwdError && <p className="admin-login__error">Mot de passe incorrect</p>}
          <button type="submit" className="admin-btn admin-btn--solid">Accéder</button>
        </form>
        <button className="admin-login__back" onClick={onExit}>← Retour au site</button>
      </div>
    </div>
  )

  const TABS = [
    { id: 'dashboard',     label: '📊 Tableau de bord' },
    { id: 'galleries',     label: '🔒 Galeries clients' },
    { id: 'photos',        label: '🖼 Photos' },
    { id: 'textes',        label: '✍️ Textes' },
    { id: 'temoignages',   label: '💬 Témoignages' },
    { id: 'services',      label: '🎯 Services' },
    { id: 'contact',       label: '📞 Contact' },
    { id: 'banniere',      label: '📢 Bannière' },
    { id: 'securite',      label: '🔐 Sécurité' },
  ]

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header__left">
          <div className="admin-header__brand">
            <svg className="admin-header__brand-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3.5"/>
              <path d="M6.343 6.343A8 8 0 1 0 17.657 17.657M8 3h8l1 3H7L8 3z"/>
            </svg>
            <span className="admin-header__brand-name">v1.0</span>
            <span className="admin-header__brand-sep">/</span>
            <span className="admin-header__brand-sub">admin</span>
          </div>
        </div>
        <div className="admin-header__right">
          <a href="/" target="_blank" rel="noreferrer" className="admin-btn admin-btn--ghost">
            👁 Voir le site
          </a>
          <button className="admin-btn admin-btn--ghost" onClick={() => setAuth(false)}>Déconnexion</button>
          <button className="admin-btn admin-btn--ghost" onClick={onExit}>← Retour</button>
        </div>
      </header>

      <div className="admin-layout">
        <nav className="admin-nav">
          {TABS.map(t => (
            <button key={t.id} className={`admin-nav__item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="admin-content">
          {tab === 'dashboard'   && <TabDashboard onExit={onExit} />}
          {tab === 'galleries'   && <TabGalleries />}
          {tab === 'photos'      && <TabPhotos />}
          {tab === 'textes'      && <TabTextes />}
          {tab === 'temoignages' && <TabTemoignages />}
          {tab === 'services'    && <TabServices />}
          {tab === 'contact'     && <TabContact />}
          {tab === 'banniere'    && <TabBanniere />}
          {tab === 'securite'    && <TabSecurite autoLogoutMin={autoLogoutMin} setAutoLogoutMin={setAutoLogoutMin} onLogout={() => setAuth(false)} />}
        </div>
      </div>
    </div>
  )
}

// ── Visit bar chart (pure SVG, no deps) ──────────────────────────────────────
function VisitChart({ history, period }) {
  const today = new Date().toISOString().slice(0, 10)
  const days = []
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, count: history[key] || 0, isToday: key === today })
  }
  const maxCount = Math.max(...days.map(d => d.count), 1)
  const W = 560, chartH = 80, topPad = 24, labelY = topPad + chartH + 16
  const H = labelY + 10
  const slotW = W / period
  const barW = Math.min(slotW * 0.52, 28)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {/* Grid lines */}
      {[0, 0.5, 1].map(r => (
        <line key={r} x1={0} y1={topPad + chartH * (1 - r)} x2={W} y2={topPad + chartH * (1 - r)}
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {days.map((d, i) => {
        const barH = Math.max((d.count / maxCount) * chartH, d.count > 0 ? 3 : 0)
        const x = i * slotW + (slotW - barW) / 2
        const y = topPad + chartH - barH
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={d.isToday ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)'} rx={2} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="inherit">
                {d.count}
              </text>
            )}
            <text x={i * slotW + slotW / 2} y={labelY} textAnchor="middle"
              fill={d.isToday ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}
              fontSize="9" fontFamily="inherit">
              {d.key.slice(8)}/{d.key.slice(5, 7)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: TABLEAU DE BORD
// ═══════════════════════════════════════════════════════════════════════════════
function TabDashboard() {
  const customPhotos = getCustomPhotos()
  const hiddenIds = getHiddenIds()
  const totalPhotos = DEFAULT_PHOTOS.length + customPhotos.length - hiddenIds.length
  const [period, setPeriod] = useState(14)
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dbGetVisitHistory().then(h => { setHistory(h); setLoading(false) })
  }, [])

  const totalVisits = Object.values(history).reduce((s, n) => s + n, 0)
  const periodVisits = (() => {
    let sum = 0
    for (let i = 0; i < period; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      sum += history[d.toISOString().slice(0, 10)] || 0
    }
    return sum
  })()
  const todayVisits = history[new Date().toISOString().slice(0, 10)] || 0

  return (
    <div className="tab-dashboard">
      <h2 className="admin-tab__title">Tableau de bord</h2>

      <div className="dashboard-stats">
        <div className="dashboard-stat">
          <span className="dashboard-stat__icon">👁</span>
          <span className="dashboard-stat__num">{totalVisits}</span>
          <span className="dashboard-stat__label">Visites totales</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat__icon">📅</span>
          <span className="dashboard-stat__num">{todayVisits}</span>
          <span className="dashboard-stat__label">Aujourd'hui</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat__icon">🖼</span>
          <span className="dashboard-stat__num">{totalPhotos}</span>
          <span className="dashboard-stat__label">Photos actives</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat__icon">📷</span>
          <span className="dashboard-stat__num">{hiddenIds.length}</span>
          <span className="dashboard-stat__label">Photo masquée</span>
        </div>
      </div>

      <div className="dashboard-chart-card">
        <div className="dashboard-chart-header">
          <span className="dashboard-chart-title">Visites — {periodVisits} sur {period} jours</span>
          <div className="dashboard-chart-periods">
            {[7, 14, 30].map(p => (
              <button key={p} className={`dashboard-period-btn ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}>{p}j</button>
            ))}
          </div>
        </div>
        {loading
          ? <p className="dashboard-chart-loading">Chargement…</p>
          : <VisitChart history={history} period={period} />
        }
      </div>

      <div className="dashboard-actions">
        <a href="/" target="_blank" rel="noreferrer" className="admin-btn admin-btn--solid">
          👁 Ouvrir le site dans un nouvel onglet
        </a>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PHOTOS
// ═══════════════════════════════════════════════════════════════════════════════
function SlidePreview({ slide }) {
  const [mode, setMode] = useState('desktop')
  const ratio = mode === 'desktop' ? '16/9' : '9/19.5'
  return (
    <div className="admin-slide-preview">
      <div className="admin-slide-preview__toggle">
        <button className={mode === 'desktop' ? 'active' : ''} onClick={() => setMode('desktop')}>🖥 Desktop</button>
        <button className={mode === 'mobile' ? 'active' : ''} onClick={() => setMode('mobile')}>📱 Mobile</button>
      </div>
      <div className="admin-slide-preview__frame" style={{ aspectRatio: ratio }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${slide.src})`,
          backgroundSize: `${slide.scale ?? 100}%`,
          backgroundPosition: `center ${slide.posY ?? 50}%`,
          backgroundRepeat: 'no-repeat',
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      </div>
    </div>
  )
}

function TabPhotos() {
  const [customPhotos, setCustomPhotos] = useState(getCustomPhotos)
  const [hiddenIds, setHiddenIds]       = useState(getHiddenIds)
  const [heroImgs, setHeroImgsState]    = useState(() => {
    const imgs = getHeroImgs()
    // Migration : strings → objets
    const normalized = imgs.map(s =>
      typeof s === 'string' ? { src: s, location: 'Contrexéville', sub: 'Vosges, France' } : s
    )
    if (normalized.length > 0) { saveHeroImgs(normalized); return normalized }
    const single = getHeroImg()
    if (single) {
      const init = [{ src: single, location: 'Contrexéville', sub: 'Vosges, France' }]
      saveHeroImgs(init); return init
    }
    return []
  })
  const [aboutImg, setAboutImgState]    = useState(getAboutImg)
  const [logoImg, setLogoImgState]      = useState(getLogoImg)
  const [newAlt, setNewAlt]   = useState('')
  const [newCat, setNewCat]   = useState(CATEGORIES[0])
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [dragId, setDragId]   = useState(null)
  const [slideUploading] = useState(false)
  const fileRef = useRef(null)
  const slideDebounceRef = useRef(null)

  const { open: openSlide, Input: SlideInput } = useFilePicker((base64) => {
    compressImage(base64, 1600, 0.82).then(compressed => {
      const id = Date.now()
      const newSlide = { src: compressed, location: '', sub: '', _id: id }
      const next = [...getHeroImgs(), newSlide]
      saveHeroImgs(next); setHeroImgsState(next)
      dbSaveAllHeroSlides(next)
    })
  })

  const removeSlide = (i) => {
    const next = heroImgs.filter((_, idx) => idx !== i)
    saveHeroImgs(next); setHeroImgsState(next)
    dbSaveAllHeroSlides(next)
  }

  const updateSlide = (i, field, value) => {
    const next = heroImgs.map((s, idx) => idx === i ? { ...s, [field]: value } : s)
    saveHeroImgs(next); setHeroImgsState(next)
    clearTimeout(slideDebounceRef.current)
    slideDebounceRef.current = setTimeout(() => dbSaveAllHeroSlides(next), 600)
  }

  const { open: openAbout, Input: AboutInput } = useFilePicker((base64) => {
    compressImage(base64, 900, 0.7).then(compressed => {
      saveAboutImg(compressed); setAboutImgState(compressed)
      dbSaveAboutImg(compressed)
    })
  })

  const { open: openLogo, Input: LogoInput } = useFilePicker((base64) => {
    removeBackground(base64).then(transparent =>
      compressImage(transparent, 400, 0.85).then(compressed => {
        saveLogoImg(compressed); setLogoImgState(compressed)
        dbSaveLogoImg(compressed)
      })
    )
  })

  const toggleHide = (id) => {
    const next = hiddenIds.includes(id) ? hiddenIds.filter(h => h !== id) : [...hiddenIds, id]
    setHiddenIds(next); saveHiddenIds(next)
    dbSaveConfig({ hiddenIds: next })
  }
  const deleteCustom = (id) => {
    const next = customPhotos.filter(p => p.id !== id)
    setCustomPhotos(next); saveCustomPhotos(next)
    dbDeleteCustomPhoto(id)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => compressImage(ev.target.result, 900, 0.65).then(setPreview)
    reader.readAsDataURL(file)
  }

  const handleAdd = (e) => {
    e.preventDefault()
    if (!preview || !newAlt) return
    setUploading(true)
    const id = Date.now()
    const newPhoto = { id, src: preview, category: newCat, alt: newAlt, isDefault: false, exif: { a: 'f/2.8', s: '1/250s', i: 'ISO 400', f: '50mm' } }
    const next = [...customPhotos, newPhoto]
    setCustomPhotos(next); saveCustomPhotos(next)
    setPreview(null); setNewAlt(''); setNewCat(CATEGORIES[0])
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false); setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    dbSaveCustomPhoto(newPhoto)
  }

  // Drag & drop reorder (custom photos only)
  const onDragStart = (id) => setDragId(id)
  const onDrop = (targetId) => {
    if (dragId === targetId) return
    const arr = [...customPhotos]
    const from = arr.findIndex(p => p.id === dragId)
    const to   = arr.findIndex(p => p.id === targetId)
    arr.splice(to, 0, arr.splice(from, 1)[0])
    setCustomPhotos(arr); saveCustomPhotos(arr)
    arr.forEach(p => dbSaveCustomPhoto(p))
    setDragId(null)
  }

  const allPhotos = [...DEFAULT_PHOTOS, ...customPhotos]

  return (
    <div className="tab-photos">
      <h2 className="admin-tab__title">Gestion des photos</h2>

      {/* Hero slideshow */}
      <div className="admin-slideshow-section">
        <div className="admin-slideshow-header">
          <p className="admin-field-label">Slideshow d'accueil{heroImgs.length > 0 ? ` — ${heroImgs.length} photo${heroImgs.length > 1 ? 's' : ''}` : ''}</p>
          <button className="admin-btn admin-btn--ghost" onClick={openSlide} disabled={slideUploading}>
            {slideUploading ? '⏳ Upload…' : '+ Ajouter une photo'}
          </button>
        </div>
        <div className="admin-slideshow-grid">
          {heroImgs.map((slide, i) => (
            <div key={i} className="admin-slide-card">
              <div className="admin-slide-thumb">
                <img src={slide.src} alt={`slide ${i + 1}`} />
                <span className="admin-slide-thumb__num">{i + 1}</span>
                <button className="admin-slide-thumb__del" onClick={() => removeSlide(i)}>×</button>
              </div>
              <SlidePreview slide={slide} />
              <div className="admin-slide-fields">
                <input
                  className="admin-slide-input"
                  placeholder="Lieu (ex: Contrexéville)"
                  value={slide.location}
                  onChange={e => updateSlide(i, 'location', e.target.value)}
                />
                <input
                  className="admin-slide-input admin-slide-input--sub"
                  placeholder="Sous-titre (ex: Vosges, France)"
                  value={slide.sub}
                  onChange={e => updateSlide(i, 'sub', e.target.value)}
                />
                <div className="admin-slide-pos">
                  <label className="admin-slide-pos__label">
                    Position verticale
                    <span>{slide.posY ?? 50}%</span>
                  </label>
                  <input
                    type="range" min="0" max="100"
                    value={slide.posY ?? 50}
                    onChange={e => updateSlide(i, 'posY', Number(e.target.value))}
                    className="admin-slide-pos__range"
                  />
                </div>
                <div className="admin-slide-pos">
                  <label className="admin-slide-pos__label">
                    Zoom
                    <span>{slide.scale ?? 100}%</span>
                  </label>
                  <input
                    type="range" min="20" max="150"
                    value={slide.scale ?? 100}
                    onChange={e => updateSlide(i, 'scale', Number(e.target.value))}
                    className="admin-slide-pos__range"
                  />
                </div>
              </div>
            </div>
          ))}
          {heroImgs.length === 0 && (
            <div className="admin-slide-empty" onClick={openSlide}>
              <span>+ Ajouter la première photo</span>
            </div>
          )}
        </div>
        <SlideInput />
      </div>

      {/* About image + Logo */}
      <div className="admin-img-editors">
        <div className="admin-img-editor">
          <p className="admin-field-label">Photo portrait (À propos)</p>
          <div className="admin-img-preview" onClick={openAbout}>
            <img src={aboutImg || '/images/about.jpg'} alt="about" onError={e => e.target.style.display='none'} />
            <div className="admin-img-preview__overlay">Changer</div>
          </div>
          <AboutInput />
        </div>
        <div className="admin-img-editor">
          <p className="admin-field-label">Logo (navbar)</p>
          <div className="admin-img-preview admin-img-preview--logo" onClick={openLogo}>
            {logoImg
              ? <img src={logoImg} alt="logo" />
              : <span className="admin-img-preview__placeholder">Aucun logo — cliquer pour uploader</span>
            }
            <div className="admin-img-preview__overlay">Changer</div>
          </div>
          <p className="admin-field-hint">PNG ou SVG recommandé. Remplace le texte dans la navbar.</p>
          {logoImg && (
            <button className="admin-btn admin-btn--ghost admin-btn--sm" style={{ marginTop: 6 }} onClick={() => { saveLogoImg(null); setLogoImgState(null) }}>
              Supprimer le logo
            </button>
          )}
          <LogoInput />
        </div>
      </div>

      {/* Upload new portfolio photo */}
      <h3 className="admin-sub-title">Ajouter une photo au portfolio</h3>
      <form className="admin-upload" onSubmit={handleAdd}>
        <div className="admin-upload__dropzone" onClick={() => fileRef.current?.click()}>
          {preview ? <img src={preview} alt="aperçu" className="admin-upload__preview" /> : (
            <>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <p>Cliquer pour choisir une photo</p>
              <span>JPG, PNG</span>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </div>
        <div className="admin-upload__fields">
          <div className="admin-field">
            <label>Description</label>
            <input type="text" placeholder="ex: Portrait en studio" value={newAlt} onChange={e => setNewAlt(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label>Catégorie</label>
            <select value={newCat} onChange={e => setNewCat(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" className="admin-btn admin-btn--solid" disabled={!preview || !newAlt || uploading}>
            {uploading ? 'Ajout…' : '+ Ajouter au portfolio'}
          </button>
          {success && <p className="admin-success">✓ Photo ajoutée !</p>}
        </div>
      </form>

      {/* Gallery management per category */}
      <h3 className="admin-sub-title">Photos par catégorie</h3>
      {CATEGORIES.map(cat => {
        const photos = allPhotos.filter(p => p.category === cat)
        return (
          <div key={cat} className="admin-cat">
            <h4 className="admin-cat__title">{cat}</h4>
            <div className="admin-grid">
              {photos.map(photo => {
                const isHidden = hiddenIds.includes(photo.id)
                return (
                  <div
                    key={photo.id}
                    className={`admin-card ${isHidden ? 'admin-card--hidden' : ''} ${!photo.isDefault ? 'admin-card--draggable' : ''}`}
                    draggable={!photo.isDefault}
                    onDragStart={() => !photo.isDefault && onDragStart(photo.id)}
                    onDragOver={e => { e.preventDefault() }}
                    onDrop={() => !photo.isDefault && onDrop(photo.id)}
                  >
                    <div className="admin-card__img">
                      <img src={photo.src} alt={photo.alt} onError={e => e.target.parentElement.classList.add('admin-card__img--broken')} />
                      {isHidden && <div className="admin-card__hidden-badge">Masqué</div>}
                      {!photo.isDefault && <div className="admin-card__drag-hint">⠿ Glisser</div>}
                    </div>
                    <div className="admin-card__info">
                      <span className="admin-card__alt">{photo.alt}</span>
                      <div className="admin-card__actions">
                        {photo.isDefault ? (
                          <button className={`admin-btn-sm ${isHidden ? 'admin-btn-sm--show' : 'admin-btn-sm--hide'}`} onClick={() => toggleHide(photo.id)}>
                            {isHidden ? '👁 Afficher' : '🙈 Masquer'}
                          </button>
                        ) : (
                          <button className="admin-btn-sm admin-btn-sm--delete" onClick={() => deleteCustom(photo.id)}>
                            🗑 Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: TEXTES
// ═══════════════════════════════════════════════════════════════════════════════
function TabTextes() {
  const [texts, setTexts] = useState(getTexts)
  const [saved, setSaved] = useState(false)

  const update = (key, val) => setTexts(t => ({ ...t, [key]: val }))
  const save = () => { saveTexts(texts); dbSaveConfig({ texts }); setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <div className="tab-textes">
      <div className="admin-tab__header">
        <h2 className="admin-tab__title">Modifier les textes</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SavedBadge show={saved} />
          <button className="admin-btn admin-btn--solid" onClick={save}>Sauvegarder</button>
        </div>
      </div>

      <div className="admin-fields-group">
        <h3 className="admin-group-title">Page d'accueil (Hero)</h3>
        <div className="admin-field">
          <label>Texte sous le nom</label>
          <input type="text" value={texts.heroEyebrow} onChange={e => update('heroEyebrow', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Phrase d'accroche (tagline)</label>
          <input type="text" value={texts.heroTagline} onChange={e => update('heroTagline', e.target.value)} />
        </div>
      </div>

      <div className="admin-fields-group">
        <h3 className="admin-group-title">Section À propos</h3>
        <div className="admin-field">
          <label>Citation</label>
          <input type="text" value={texts.aboutQuote} onChange={e => update('aboutQuote', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Paragraphe 1</label>
          <textarea rows={4} value={texts.aboutP1} onChange={e => update('aboutP1', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Paragraphe 2</label>
          <textarea rows={4} value={texts.aboutP2} onChange={e => update('aboutP2', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Paragraphe 3</label>
          <textarea rows={4} value={texts.aboutP3} onChange={e => update('aboutP3', e.target.value)} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: TÉMOIGNAGES
// ═══════════════════════════════════════════════════════════════════════════════
function TabTemoignages() {
  const [items, setItems] = useState(getTestimonials)
  const [saved, setSaved] = useState(false)
  const empty = { id: Date.now(), name: '', context: '', text: '', stars: 5 }
  const [newItem, setNewItem] = useState(empty)

  const save = (list) => { saveTestimonials(list); dbSaveConfig({ testimonials: list }); setItems(list); setSaved(true); setTimeout(() => setSaved(false), 2500) }

  const updateItem = (id, key, val) => {
    const next = items.map(t => t.id === id ? { ...t, [key]: val } : t)
    save(next)
  }
  const deleteItem = (id) => save(items.filter(t => t.id !== id))
  const addItem = () => {
    if (!newItem.name || !newItem.text) return
    save([...items, { ...newItem, id: Date.now() }])
    setNewItem(empty)
  }

  return (
    <div className="tab-temoignages">
      <div className="admin-tab__header">
        <h2 className="admin-tab__title">Témoignages</h2>
        <SavedBadge show={saved} />
      </div>

      <div className="temoignage-list">
        {items.map(t => (
          <div key={t.id} className="temoignage-card">
            <div className="temoignage-card__fields">
              <div className="admin-field-row">
                <div className="admin-field">
                  <label>Nom</label>
                  <input type="text" value={t.name} onChange={e => updateItem(t.id, 'name', e.target.value)} />
                </div>
                <div className="admin-field">
                  <label>Contexte (ex: Séance famille)</label>
                  <input type="text" value={t.context} onChange={e => updateItem(t.id, 'context', e.target.value)} />
                </div>
                <div className="admin-field" style={{ maxWidth: 80 }}>
                  <label>Étoiles</label>
                  <select value={t.stars} onChange={e => updateItem(t.id, 'stars', Number(e.target.value))}>
                    {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-field">
                <label>Témoignage</label>
                <textarea rows={3} value={t.text} onChange={e => updateItem(t.id, 'text', e.target.value)} />
              </div>
            </div>
            <button className="admin-btn-sm admin-btn-sm--delete" onClick={() => deleteItem(t.id)}>🗑 Supprimer</button>
          </div>
        ))}
      </div>

      <div className="admin-add-block">
        <h3 className="admin-sub-title">Ajouter un témoignage</h3>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Nom</label>
            <input type="text" value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))} placeholder="Marie D." />
          </div>
          <div className="admin-field">
            <label>Contexte</label>
            <input type="text" value={newItem.context} onChange={e => setNewItem(n => ({ ...n, context: e.target.value }))} placeholder="Séance portrait" />
          </div>
          <div className="admin-field" style={{ maxWidth: 80 }}>
            <label>Étoiles</label>
            <select value={newItem.stars} onChange={e => setNewItem(n => ({ ...n, stars: Number(e.target.value) }))}>
              {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="admin-field">
          <label>Témoignage</label>
          <textarea rows={3} value={newItem.text} onChange={e => setNewItem(n => ({ ...n, text: e.target.value }))} placeholder="Écrivez le témoignage ici..." />
        </div>
        <button className="admin-btn admin-btn--solid" onClick={addItem} disabled={!newItem.name || !newItem.text}>
          + Ajouter
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SERVICES
// ═══════════════════════════════════════════════════════════════════════════════
function TabServices() {
  const [items, setItems] = useState(getServices)
  const [saved, setSaved] = useState(false)

  const save = (list) => { saveServices(list); dbSaveConfig({ services: list }); setItems(list); setSaved(true); setTimeout(() => setSaved(false), 2500) }
  const update = (id, key, val) => save(items.map(s => s.id === id ? { ...s, [key]: val } : s))
  const updateDetails = (id, val) => update(id, 'details', val.split('\n').filter(Boolean))
  const remove = (id) => save(items.filter(s => s.id !== id))

  return (
    <div className="tab-services">
      <div className="admin-tab__header">
        <h2 className="admin-tab__title">Services</h2>
        <SavedBadge show={saved} />
      </div>

      <div className="services-list">
        {items.map(s => (
          <div key={s.id} className="service-edit-card">
            <div className="admin-field" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Titre</label>
              <button className="admin-slide-thumb__del" style={{ position: 'static' }} onClick={() => remove(s.id)}>×</button>
            </div>
            <div className="admin-field">
              <input type="text" value={s.title} onChange={e => update(s.id, 'title', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>Description</label>
              <textarea rows={3} value={s.description} onChange={e => update(s.id, 'description', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>Prestations (une par ligne)</label>
              <textarea rows={4} value={s.details.join('\n')} onChange={e => updateDetails(s.id, e.target.value)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CONTACT
// ═══════════════════════════════════════════════════════════════════════════════
function TabContact() {
  const [data, setData] = useState(getContact)
  const [saved, setSaved] = useState(false)

  const update = (key, val) => setData(d => ({ ...d, [key]: val }))
  const save = () => { saveContact(data); dbSaveConfig({ contact: data }); setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <div className="tab-contact">
      <div className="admin-tab__header">
        <h2 className="admin-tab__title">Informations de contact</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SavedBadge show={saved} />
          <button className="admin-btn admin-btn--solid" onClick={save}>Sauvegarder</button>
        </div>
      </div>

      <div className="admin-fields-group">
        <div className="admin-field">
          <label>Adresse email</label>
          <input type="email" value={data.email} onChange={e => update('email', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Téléphone</label>
          <input type="text" value={data.phone} onChange={e => update('phone', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Localisation</label>
          <input type="text" value={data.location} onChange={e => update('location', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Lien Facebook (URL complète)</label>
          <input type="url" value={data.facebook} onChange={e => update('facebook', e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Nom Facebook (ex: ayenouphoto)</label>
          <input type="text" value={data.facebookHandle} onChange={e => update('facebookHandle', e.target.value)} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: BANNIÈRE
// ═══════════════════════════════════════════════════════════════════════════════
function TabBanniere() {
  const [banner, setBanner] = useState(getBanner)
  const [saved, setSaved] = useState(false)

  function save() {
    saveBanner(banner)
    dbSaveConfig({ banner })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="admin-section">
      <h2 className="admin-tab__title">Bannière d'annonce</h2>
      <p className="admin-section__desc">
        Affiche une barre de message en haut du site. Le visiteur peut la fermer.
      </p>

      <div className="admin-field">
        <label className="admin-label">Activer la bannière</label>
        <label className="admin-toggle">
          <input type="checkbox" checked={banner.enabled}
            onChange={e => setBanner({ ...banner, enabled: e.target.checked })} />
          <span className="admin-toggle__track" />
          <span className="admin-toggle__label">{banner.enabled ? 'Activée' : 'Désactivée'}</span>
        </label>
      </div>

      <div className="admin-field">
        <label className="admin-label">Message</label>
        <input className="admin-input" type="text"
          placeholder="Ex : Disponible pour des séances cet été !"
          value={banner.text}
          onChange={e => setBanner({ ...banner, text: e.target.value })} />
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label className="admin-label">Lien (optionnel)</label>
          <input className="admin-input" type="url"
            placeholder="https://..."
            value={banner.link}
            onChange={e => setBanner({ ...banner, link: e.target.value })} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Texte du lien</label>
          <input className="admin-input" type="text"
            placeholder="En savoir plus"
            value={banner.linkLabel}
            onChange={e => setBanner({ ...banner, linkLabel: e.target.value })} />
        </div>
      </div>

      {banner.enabled && banner.text && (
        <div className="banner-preview">
          <span className="banner-preview__text">
            {banner.text}
            {banner.link && <span className="banner-preview__link"> — {banner.linkLabel || 'En savoir plus'}</span>}
          </span>
          <span className="banner-preview__close">×</span>
        </div>
      )}

      <div className="admin-actions">
        <button className="admin-btn admin-btn--solid" onClick={save}>Sauvegarder</button>
        <SavedBadge show={saved} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GALERIES CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════
function TabGalleries() {
  const [galleries, setGalleries] = useState([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState(null) // code of open gallery

  useEffect(() => {
    dbGetAllGalleries().then(setGalleries)
  }, [])

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const createGallery = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const gallery = { code: generateCode(), clientName: newName.trim(), createdAt: Date.now(), photos: [] }
    await dbCreateGallery(gallery)
    setGalleries(prev => [gallery, ...prev])
    setNewName('')
    setExpanded(gallery.code)
    setCreating(false)
  }

  const deleteGallery = async (code) => {
    if (!window.confirm('Supprimer cette galerie et toutes ses photos ?')) return
    await dbDeleteGallery(code)
    setGalleries(prev => prev.filter(g => g.code !== code))
    if (expanded === code) setExpanded(null)
  }

  const addPhoto = (code, photo) => {
    setGalleries(prev => prev.map(g => g.code === code ? { ...g, photos: [...(g.photos || []), photo] } : g))
  }

  const removePhoto = async (galleryCode, photoId) => {
    await dbDeleteGalleryPhoto(photoId)
    setGalleries(prev => prev.map(g => g.code === galleryCode ? { ...g, photos: g.photos.filter(p => p.id !== photoId) } : g))
  }

  const copyLink = (code) => {
    const url = `${window.location.origin}/galerie/${code}`
    navigator.clipboard.writeText(url).then(() => alert('Lien copié !'))
  }

  return (
    <div className="tab-galleries">
      <div className="admin-tab__header">
        <h2 className="admin-tab__title">Galeries clients</h2>
      </div>

      {/* Create form */}
      <div className="gallery-create-form">
        <input
          className="admin-input"
          placeholder="Nom du client (ex: Martin & Sophie)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createGallery()}
        />
        <button className="admin-btn admin-btn--solid" onClick={createGallery} disabled={creating || !newName.trim()}>
          {creating ? '⏳' : '+ Créer la galerie'}
        </button>
      </div>

      {/* Gallery list */}
      {galleries.length === 0 && (
        <p className="gallery-empty">Aucune galerie pour le moment.</p>
      )}

      <div className="gallery-list">
        {galleries.map(g => (
          <GalleryCard
            key={g.code}
            gallery={g}
            expanded={expanded === g.code}
            onToggle={() => setExpanded(expanded === g.code ? null : g.code)}
            onDelete={() => deleteGallery(g.code)}
            onCopyLink={() => copyLink(g.code)}
            onAddPhoto={(photo) => addPhoto(g.code, photo)}
            onRemovePhoto={(photoId) => removePhoto(g.code, photoId)}
          />
        ))}
      </div>
    </div>
  )
}

function GalleryCard({ gallery, expanded, onToggle, onDelete, onCopyLink, onAddPhoto, onRemovePhoto }) {
  const url = `${window.location.origin}/galerie/${gallery.code}`

  const { open: openPhoto, Input: PhotoInput } = useFilePicker((base64) => {
    compressImage(base64, 900, 0.7).then(compressed => {
      const photo = { id: Date.now(), galleryCode: gallery.code, src: compressed, caption: '', order: (gallery.photos || []).length }
      dbAddGalleryPhoto(photo).then(() => onAddPhoto(photo))
    })
  })

  return (
    <div className={`gallery-card ${expanded ? 'gallery-card--open' : ''}`}>
      <div className="gallery-card__header" onClick={onToggle}>
        <div className="gallery-card__info">
          <span className="gallery-card__name">{gallery.clientName}</span>
          <span className="gallery-card__meta">{gallery.code} · {(gallery.photos || []).length} photo{(gallery.photos || []).length !== 1 ? 's' : ''}</span>
        </div>
        <div className="gallery-card__actions" onClick={e => e.stopPropagation()}>
          <button className="admin-btn admin-btn--ghost" onClick={onCopyLink} title="Copier le lien">🔗 Lien</button>
          <button className="admin-btn admin-btn--danger" onClick={onDelete}>Supprimer</button>
        </div>
        <span className="gallery-card__chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="gallery-card__body">
          <div className="gallery-link-row">
            <span className="gallery-link-url">{url}</span>
          </div>
          <div className="gallery-card__photos">
            {(gallery.photos || []).map((photo, i) => (
              <div key={photo.id} className="gallery-photo-thumb">
                <img src={photo.src} alt={`Photo ${i + 1}`} />
                <button className="admin-slide-thumb__del" onClick={() => onRemovePhoto(photo.id)}>×</button>
              </div>
            ))}
            <button className="gallery-add-photo" onClick={openPhoto}>
              <span>+</span>
              <span>Ajouter</span>
            </button>
          </div>
          <PhotoInput />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SÉCURITÉ
// ═══════════════════════════════════════════════════════════════════════════════
function TabSecurite({ autoLogoutMin, setAutoLogoutMin, onLogout }) {
  const [oldPwd, setOldPwd]   = useState('')
  const [newPwd, setNewPwd]   = useState('')
  const [confPwd, setConfPwd] = useState('')
  const [pwdMsg, setPwdMsg]   = useState(null)
  const [logoutMin, setLogoutMin] = useState(autoLogoutMin)

  const changePwd = (e) => {
    e.preventDefault()
    if (oldPwd !== getPassword()) { setPwdMsg({ type: 'error', text: 'Ancien mot de passe incorrect.' }); return }
    if (newPwd.length < 4) { setPwdMsg({ type: 'error', text: 'Le nouveau mot de passe doit faire au moins 4 caractères.' }); return }
    if (newPwd !== confPwd) { setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' }); return }
    savePassword(newPwd); dbSaveConfig({ password: newPwd })
    setOldPwd(''); setNewPwd(''); setConfPwd('')
    setPwdMsg({ type: 'success', text: '✓ Mot de passe modifié avec succès.' })
    setTimeout(() => setPwdMsg(null), 3000)
  }

  const saveLogout = () => {
    setAutoLogoutMin(logoutMin)
  }

  return (
    <div className="tab-securite">
      <h2 className="admin-tab__title">Sécurité</h2>

      <div className="admin-fields-group">
        <h3 className="admin-group-title">Changer le mot de passe</h3>
        <form onSubmit={changePwd} className="admin-pwd-form">
          <div className="admin-field">
            <label>Ancien mot de passe</label>
            <input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label>Nouveau mot de passe</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label>Confirmer le nouveau mot de passe</label>
            <input type="password" value={confPwd} onChange={e => setConfPwd(e.target.value)} required />
          </div>
          {pwdMsg && <p className={pwdMsg.type === 'error' ? 'admin-error' : 'admin-success'}>{pwdMsg.text}</p>}
          <button type="submit" className="admin-btn admin-btn--solid">Changer le mot de passe</button>
        </form>
      </div>

      <div className="admin-fields-group">
        <h3 className="admin-group-title">Déconnexion automatique</h3>
        <p className="admin-hint">Se déconnecter automatiquement après une période d'inactivité.</p>
        <div className="admin-logout-row">
          <div className="admin-field" style={{ maxWidth: 200 }}>
            <label>Délai en minutes (0 = désactivé)</label>
            <input type="number" min="0" max="120" value={logoutMin} onChange={e => setLogoutMin(Number(e.target.value))} />
          </div>
          <button className="admin-btn admin-btn--solid" onClick={saveLogout}>Appliquer</button>
        </div>
      </div>

      <div className="admin-fields-group">
        <h3 className="admin-group-title">Session</h3>
        <button className="admin-btn admin-btn--ghost" onClick={onLogout} style={{ borderColor: '#e63946', color: '#e63946' }}>
          Se déconnecter maintenant
        </button>
      </div>
    </div>
  )
}
