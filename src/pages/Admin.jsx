import { useState, useRef, useEffect, createContext, useContext } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '../firebase'
import {
  getCustomPhotos, saveCustomPhotos, getHiddenIds, saveHiddenIds, getCoupsDeCoeur, saveCoupsDeCoeur,
  getHeroImg, getHeroImgs, saveHeroImgs, getAboutImg, saveAboutImg, getLogoImg, saveLogoImg,
  getTexts, saveTexts,
  getTestimonials, saveTestimonials,
  getServices, saveServices,
  getContact, saveContact,
  getPassword, savePassword, hashPassword, isHashed,
  getBanner, saveBanner,
  updateLastActive,
} from '../utils/storage'
import './Admin.css'
import { dbSaveConfig, dbSaveAboutImg, dbSaveLogoImg, dbSaveCustomPhoto, dbDeleteCustomPhoto, dbSaveAllHeroSlides, dbGetVisitHistory, dbCreateGallery, dbDeleteGallery, dbAddGalleryPhoto, dbDeleteGalleryPhoto, dbGetAllGalleries, dbGetAvailability, dbSaveAvailability, dbAddLoginAttempt, dbGetLoginHistory, dbClearLoginHistory, dbPingFirestore, dbCreateSession, dbGetSessions, dbDeleteSession, dbRemovePassword, dbMigrateBase64ToCloudinary, dbMigrateHeroSlidesToCloudinary } from '../utils/db'

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

// Grave le watermark © YENOU André Photographie directement dans les pixels de l'image
function addWatermark(base64) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      const fontSize = Math.max(Math.round(w * 0.016), 14)
      const text = '© YENOU André Photographie'
      ctx.font = `300 ${fontSize}px Arial, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'

      const padding = Math.round(w * 0.02)
      ctx.fillText(text, w - padding, h - padding)

      resolve(canvas.toDataURL('image/jpeg', 0.88))
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

// ── Count-up animation hook ───────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) { setVal(0); return }
    let start = null
    let raf
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

function StatNumber({ value }) {
  const n = useCountUp(value)
  return <span className="dashboard-stat__num">{n}</span>
}

// ── Nav SVG icons ─────────────────────────────────────────────────────────────
const NAV_ICONS = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  galleries: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  photos: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7l-2-4H10L8 7"/><circle cx="12" cy="14" r="3"/></svg>,
  textes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  temoignages: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  services: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  contact: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  banniere: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>,
  disponibilites: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  securite: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
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

// ── TOAST ─────────────────────────────────────────────────────────────────────
const ToastCtx = createContext(null)
function useToast() { return useContext(ToastCtx) }

function ToastContainer({ toasts }) {
  return (
    <div className="admin-toasts">
      {toasts.map(t => (
        <div key={t.id} className={`admin-toast admin-toast--${t.type}`}>
          {t.type === 'success' ? '✓' : '✕'} {t.msg}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
const LOCKOUT_KEY = 'admin_lockout'
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes
const ADMIN_EMAIL = 'admin@yenouphotographie.fr'

async function firebaseLogin(password) {
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password)
    return true
  } catch (e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-email') {
      try { await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, password); return true } catch { /* ignore */ }
    }
    return false
  }
}

function getLockoutState() {
  try { return JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '{}') } catch { return {} }
}
function saveLockoutState(state) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state))
}

export default function Admin({ onExit }) {
  const [auth, setAuth]       = useState(false)
  const [pwd, setPwd]         = useState('')
  const [pwdError, setPwdError] = useState(false)
  const [tab, setTab]         = useState('dashboard')
  const [autoLogoutMin, setAutoLogoutMin] = useState(30)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  const [loginDisabled, setLoginDisabled] = useState(false)
  const [toasts, setToasts] = useState([])
  const navRef = useRef(null)
  const [pillStyle, setPillStyle] = useState({ top: 0, height: 0 })
  const handleLogout = () => {
    signOut(auth).catch(() => {})
    const sid = localStorage.getItem('yenou_session_id')
    if (sid) { dbDeleteSession(sid); localStorage.removeItem('yenou_session_id') }
    setAuth(false)
  }
  useAutoLogout(auth ? autoLogoutMin : 0, handleLogout)

  useEffect(() => {
    if (!navRef.current) return
    const el = navRef.current.querySelector(`[data-tab-id="${tab}"]`)
    if (el) setPillStyle({ top: el.offsetTop, height: el.offsetHeight })
  }, [tab])

  // Check lockout on mount and on timer
  useEffect(() => {
    const check = () => {
      const state = getLockoutState()
      if (state.lockedUntil && Date.now() < state.lockedUntil) {
        const remaining = Math.ceil((state.lockedUntil - Date.now()) / 1000)
        setLockoutRemaining(remaining)
        setLoginDisabled(true)
      } else {
        setLockoutRemaining(0)
        setLoginDisabled(false)
      }
    }
    check()
    const interval = setInterval(check, 1000)
    return () => clearInterval(interval)
  }, [])

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    if (loginDisabled) return

    const state = getLockoutState()
    const attempts = state.attempts || 0

    // Try Firebase Auth as primary (firebaseLogin uses the imported auth, not local state)
    const firebaseOk = await firebaseLogin(pwd)

    // Fallback: local hash check
    let localOk = false
    if (!firebaseOk) {
      const stored = getPassword()
      const hashedInput = await hashPassword(pwd)
      localOk = stored
        ? (hashedInput === stored || (!isHashed(stored) && pwd === stored))
        : false
    }

    if (firebaseOk || localOk) {
      await savePassword(pwd)
      dbRemovePassword()
      dbMigrateBase64ToCloudinary()
      dbMigrateHeroSlidesToCloudinary()
      saveLockoutState({})
      setAuth(true)
      setPwdError(false)
      const sessionId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))
      localStorage.setItem('yenou_session_id', sessionId)
      dbCreateSession({ id: sessionId, ua: navigator.userAgent, loginAt: Date.now() })
    } else {
      const newAttempts = attempts + 1
      const locked = newAttempts >= MAX_ATTEMPTS
      dbAddLoginAttempt({ at: Date.now(), attempt: newAttempts, locked })
      if (locked) {
        const lockedUntil = Date.now() + LOCKOUT_DURATION
        saveLockoutState({ attempts: newAttempts, lockedUntil })
        setLoginDisabled(true)
      } else {
        saveLockoutState({ attempts: newAttempts })
      }
      setPwdError(true)
    }
  }

  const attemptsLeft = MAX_ATTEMPTS - (getLockoutState().attempts || 0)
  const formatRemaining = (s) => s >= 60 ? `${Math.ceil(s/60)} min` : `${s}s`

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
            className={`admin-login__input ${pwdError ? 'error' : ''}`}
            autoFocus disabled={loginDisabled} />
          {loginDisabled && lockoutRemaining > 0 && (
            <p className="admin-login__error">Trop de tentatives. Réessayez dans {formatRemaining(lockoutRemaining)}.</p>
          )}
          {pwdError && !loginDisabled && (
            <p className="admin-login__error">
              Mot de passe incorrect.{attemptsLeft > 0 && attemptsLeft <= 3 ? ` ${attemptsLeft} tentative${attemptsLeft > 1 ? 's' : ''} restante${attemptsLeft > 1 ? 's' : ''}.` : ''}
            </p>
          )}
          <button type="submit" className="admin-btn admin-btn--solid" disabled={loginDisabled}>Accéder</button>
        </form>
        <button className="admin-login__back" onClick={onExit}>← Retour au site</button>
      </div>
    </div>
  )

  const TABS = [
    { id: 'dashboard',      label: 'Tableau de bord' },
    { id: 'galleries',      label: 'Galeries' },
    { id: 'photos',         label: 'Photos' },
    { id: 'textes',         label: 'Textes' },
    { id: 'temoignages',    label: 'Avis' },
    { id: 'services',       label: 'Services' },
    { id: 'contact',        label: 'Contact' },
    { id: 'banniere',       label: 'Bannière' },
    { id: 'disponibilites', label: 'Dispo' },
    { id: 'securite',       label: 'Sécurité' },
  ]

  const showToast = (msg, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  return (
    <ToastCtx.Provider value={showToast}>
    <div className="admin">
      <ToastContainer toasts={toasts} />
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
            <span className="admin-btn__icon">👁</span><span className="admin-btn__text"> Voir le site</span>
          </a>
          <button className="admin-btn admin-btn--ghost" onClick={handleLogout}>
            <span className="admin-btn__icon">⏻</span><span className="admin-btn__text"> Déconnexion</span>
          </button>
          <button className="admin-btn admin-btn--ghost" onClick={onExit}>
            <span className="admin-btn__icon">←</span><span className="admin-btn__text"> Retour</span>
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <nav className="admin-nav" ref={navRef}>
          <div className="admin-nav__pill" style={{ top: pillStyle.top, height: pillStyle.height }} />
          {TABS.map(t => (
            <button key={t.id} data-tab-id={t.id} className={`admin-nav__item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}>
              <span className="admin-nav__icon">{NAV_ICONS[t.id]}</span>
              <span className="admin-nav__label">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-content">
          <div key={tab} className="admin-tab-anim">
            {tab === 'dashboard'   && <TabDashboard onExit={onExit} />}
            {tab === 'galleries'   && <TabGalleries />}
            {tab === 'photos'      && <TabPhotos />}
            {tab === 'textes'      && <TabTextes />}
            {tab === 'temoignages' && <TabTemoignages />}
            {tab === 'services'    && <TabServices />}
            {tab === 'contact'     && <TabContact />}
            {tab === 'banniere'    && <TabBanniere />}
            {tab === 'disponibilites' && <TabDisponibilites />}
            {tab === 'securite'    && <TabSecurite autoLogoutMin={autoLogoutMin} setAutoLogoutMin={setAutoLogoutMin} onLogout={handleLogout} />}
          </div>
        </div>
      </div>
    </div>
    </ToastCtx.Provider>
  )
}

// ── Visit bar chart (pure SVG, no deps) ──────────────────────────────────────
function VisitChart({ history, period }) {
  const [hovered, setHovered] = useState(null)
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
  const labelEvery = period <= 7 ? 1 : period <= 14 ? 2 : 5

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 0.5, 1].map(r => (
        <line key={r} x1={0} y1={topPad + chartH * (1 - r)} x2={W} y2={topPad + chartH * (1 - r)}
          stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      ))}
      {days.map((d, i) => {
        const barH = Math.max((d.count / maxCount) * chartH, d.count > 0 ? 3 : 0)
        const x = i * slotW + (slotW - barW) / 2
        const y = topPad + chartH - barH
        const isHovered = hovered === i
        const tooltipX = Math.min(Math.max(x + barW / 2, 28), W - 28)
        const tooltipY = y - 14
        return (
          <g key={d.key} style={{ cursor: 'default' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}>
            {/* Hit zone */}
            <rect x={i * slotW} y={topPad} width={slotW} height={chartH}
              fill="transparent" />
            {/* Bar */}
            <rect x={x} y={y} width={barW} height={barH}
              fill={isHovered ? '#6366f1' : d.isToday ? '#818cf8' : 'rgba(99,102,241,0.3)'}
              rx={2}
              className="chart-bar"
              style={{ animationDelay: `${i * 0.04}s`, transition: 'fill 0.15s' }} />
            {/* Labels */}
            {(i % labelEvery === 0 || d.isToday) && (
              <text x={i * slotW + slotW / 2} y={labelY} textAnchor="middle"
                fill={d.isToday ? '#6366f1' : 'rgba(0,0,0,0.25)'}
                fontSize="9" fontFamily="inherit"
                fontWeight={d.isToday ? '600' : '400'}>
                {d.key.slice(8)}/{d.key.slice(5, 7)}
              </text>
            )}
            {/* Tooltip on hover */}
            {isHovered && (
              <g>
                <rect x={tooltipX - 22} y={tooltipY - 13} width={44} height={18}
                  rx={4} fill="rgba(30,30,30,0.95)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                <text x={tooltipX} y={tooltipY} textAnchor="middle"
                  fill="white" fontSize="10" fontFamily="inherit" fontWeight="500">
                  {d.count} visite{d.count !== 1 ? 's' : ''}
                </text>
              </g>
            )}
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
          <span className="dashboard-stat__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="22" height="22"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </span>
          <StatNumber value={totalVisits} />
          <span className="dashboard-stat__label">Visites totales</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="22" height="22"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          <StatNumber value={todayVisits} />
          <span className="dashboard-stat__label">Aujourd'hui</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="22" height="22"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7l-2-4H10L8 7"/><circle cx="12" cy="14" r="3"/></svg>
          </span>
          <StatNumber value={totalPhotos} />
          <span className="dashboard-stat__label">Photos actives</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="22" height="22"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </span>
          <StatNumber value={hiddenIds.length} />
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
  const showToast = useToast()
  const [customPhotos, setCustomPhotos]       = useState(getCustomPhotos)
  const [hiddenIds, setHiddenIds]             = useState(getHiddenIds)
  const [coupsDeCoeur, setCoupsDeCoeur]       = useState(getCoupsDeCoeur)
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

  const toggleCoupDeCoeur = (id) => {
    const next = coupsDeCoeur.includes(id) ? coupsDeCoeur.filter(c => c !== id) : [...coupsDeCoeur, id]
    setCoupsDeCoeur(next); saveCoupsDeCoeur(next)
    dbSaveConfig({ coupsDeCoeur: next })
  }
  const deleteCustom = async (id) => {
    await dbDeleteCustomPhoto(id)
    const next = customPhotos.filter(p => p.id !== id)
    setCustomPhotos(next); saveCustomPhotos(next)
  }

  const renamePhoto = (id, newAlt) => {
    const next = customPhotos.map(p => p.id === id ? { ...p, alt: newAlt } : p)
    setCustomPhotos(next); saveCustomPhotos(next)
    const photo = next.find(p => p.id === id)
    if (photo) dbSaveCustomPhoto(photo)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => compressImage(ev.target.result, 900, 0.65).then(setPreview)
    reader.readAsDataURL(file)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!preview || !newAlt) return
    setUploading(true)
    try {
      const id = Date.now()
      const newPhoto = { id, src: preview, category: newCat, alt: newAlt, isDefault: false, exif: { a: 'f/2.8', s: '1/250s', i: 'ISO 400', f: '50mm' } }
      // Upload vers Firebase Storage, récupère l'URL publique
      const savedPhoto = await dbSaveCustomPhoto(newPhoto)
      const next = [...customPhotos, savedPhoto]
      setCustomPhotos(next)
      saveCustomPhotos(next)
      setPreview(null); setNewAlt(''); setNewCat(CATEGORIES[0])
      if (fileRef.current) fileRef.current.value = ''
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      showToast('Erreur lors de la sauvegarde. Réessaie.', 'error')
    } finally {
      setUploading(false)
    }
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
            <h4 className="admin-cat__title">{cat} <span className="admin-cat__count">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span></h4>
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
                      {photo.isDefault ? (
                        <span className="admin-card__alt">{photo.alt}</span>
                      ) : (
                        <input
                          className="admin-card__alt-input"
                          value={photo.alt}
                          onChange={e => renamePhoto(photo.id, e.target.value)}
                          placeholder="Nom de la photo"
                        />
                      )}
                      <div className="admin-card__actions">
                        <button
                          className={`admin-btn-sm ${coupsDeCoeur.includes(photo.id) ? 'admin-btn-sm--cdc-on' : 'admin-btn-sm--cdc'}`}
                          onClick={() => toggleCoupDeCoeur(photo.id)}
                          title="Coup de cœur"
                        >
                          {coupsDeCoeur.includes(photo.id) ? '★ Coup de cœur' : '☆ Coup de cœur'}
                        </button>
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
  const toast = useToast()

  const update = (key, val) => setTexts(t => ({ ...t, [key]: val }))
  const save = () => { saveTexts(texts); dbSaveConfig({ texts }); toast('Textes sauvegardés') }

  return (
    <div className="tab-textes">
      <div className="admin-tab__header">
        <h2 className="admin-tab__title">Modifier les textes</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
  const toast = useToast()
  const empty = { id: Date.now(), name: '', context: '', text: '', stars: 5 }
  const [newItem, setNewItem] = useState(empty)

  const save = (list) => { saveTestimonials(list); dbSaveConfig({ testimonials: list }); setItems(list); toast('Témoignage sauvegardé') }

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
  const toast = useToast()

  const save = (list) => { saveServices(list); dbSaveConfig({ services: list }); setItems(list); toast('Service sauvegardé') }
  const update = (id, key, val) => save(items.map(s => s.id === id ? { ...s, [key]: val } : s))
  const updateDetails = (id, val) => update(id, 'details', val.split('\n').filter(Boolean))
  const remove = (id) => save(items.filter(s => s.id !== id))

  return (
    <div className="tab-services">
      <div className="admin-tab__header">
        <h2 className="admin-tab__title">Services</h2>
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
  const toast = useToast()

  const update = (key, val) => setData(d => ({ ...d, [key]: val }))
  const save = () => { saveContact(data); dbSaveConfig({ contact: data }); toast('Contact sauvegardé') }

  return (
    <div className="tab-contact">
      <div className="admin-tab__header">
        <h2 className="admin-tab__title">Informations de contact</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
  const toast = useToast()

  function save() {
    saveBanner(banner)
    dbSaveConfig({ banner })
    toast('Bannière sauvegardée')
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

  const generateCode = (len = 6) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const createGallery = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const gallery = { code: generateCode(6), password: generateCode(4), clientName: newName.trim(), createdAt: Date.now(), photos: [] }
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
        <button className="admin-btn admin-btn--ghost" onClick={() => dbGetAllGalleries().then(setGalleries)}>↻ Rafraîchir</button>
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
  const fileInputRef = useRef(null)
  const [uploadProgress, setUploadProgress] = useState(null) // "3/8" or null

  const exportSelection = async () => {
    const selected = (gallery.selectedPhotos || [])
    const photos = (gallery.photos || []).filter(p => selected.includes(p.id))
    if (!photos.length) return

    const COLS = 3
    const THUMB = 400
    const PAD = 16
    const HEADER = 60
    const rows = Math.ceil(photos.length / COLS)
    const W = COLS * THUMB + (COLS + 1) * PAD
    const H = HEADER + rows * THUMB + (rows + 1) * PAD

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillText(`${gallery.clientName} — Sélection (${photos.length} photo${photos.length > 1 ? 's' : ''})`, PAD, 38)

    await Promise.all(photos.map((photo, i) => new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const x = PAD + col * (THUMB + PAD)
        const y = HEADER + PAD + row * (THUMB + PAD)
        // draw photo cropped to square-ish
        const scale = Math.max(THUMB / img.width, THUMB / img.height)
        const sw = THUMB / scale, sh = THUMB / scale
        const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2
        ctx.drawImage(img, sx, sy, sw, sh, x, y, THUMB, THUMB)
        // number badge
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(x + 6, y + 6, 32, 20)
        ctx.fillStyle = 'white'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(`#${i + 1}`, x + 10, y + 20)
        // filename
        if (photo.filename) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)'
          ctx.fillRect(x, y + THUMB - 22, THUMB, 22)
          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.font = '11px sans-serif'
          ctx.fillText(photo.filename.slice(0, 40), x + 6, y + THUMB - 7)
        }
        resolve()
      }
      img.onerror = resolve
      img.src = photo.src
    })))

    const link = document.createElement('a')
    link.download = `selection-${gallery.clientName.replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    e.target.value = ''
    for (let i = 0; i < files.length; i++) {
      setUploadProgress(`${i + 1}/${files.length}`)
      const base64 = await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target.result)
        reader.readAsDataURL(files[i])
      })
      const watermarked = await compressImage(base64, 900, 0.7).then(addWatermark)
      const filename = files[i].name.replace(/\.[^.]+$/, '') // sans extension
      const photo = { id: Date.now() + i, galleryCode: gallery.code, src: watermarked, caption: '', order: (gallery.photos || []).length + i, filename }
      await dbAddGalleryPhoto(photo)
      onAddPhoto(photo)
    }
    setUploadProgress(null)
  }

  return (
    <div className={`gallery-card ${expanded ? 'gallery-card--open' : ''}`}>
      <div className="gallery-card__header" onClick={onToggle}>
        <div className="gallery-card__info">
          <span className="gallery-card__name">{gallery.clientName}</span>
          <span className="gallery-card__meta">
            {gallery.code} · {(gallery.photos || []).length} photo{(gallery.photos || []).length !== 1 ? 's' : ''}
            {gallery.views ? ` · 👁 ${gallery.views} vue${gallery.views > 1 ? 's' : ''}` : ' · Pas encore consulté'}
            {gallery.lastView ? ` · ${new Date(gallery.lastView).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            {gallery.selectionValidated ? ` · ✅ ${(gallery.selectedPhotos || []).length} sélectionnée${(gallery.selectedPhotos || []).length > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <div className="gallery-card__actions" onClick={e => e.stopPropagation()}>
          {gallery.password && (
            <span className="gallery-card__pwd" title="Mot de passe client">🔑 <strong>{gallery.password}</strong></span>
          )}
          {gallery.selectionValidated && (gallery.selectedPhotos || []).length > 0 && (
            <button className="admin-btn admin-btn--ghost" onClick={exportSelection} title="Exporter la sélection">⬇ Sélection</button>
          )}
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
            {(gallery.photos || []).map((photo, i) => {
              const isChosen = (gallery.selectedPhotos || []).includes(photo.id)
              return (
                <div key={photo.id} className={`gallery-photo-thumb ${isChosen ? 'gallery-photo-thumb--chosen' : ''}`}>
                  <img src={photo.src} alt={`Photo ${i + 1}`} />
                  <span className="gallery-photo-num">{i + 1}</span>
                  {isChosen && <span className="gallery-photo-check">✓</span>}
                  {photo.filename && <span className="gallery-photo-name" title={photo.filename}>{photo.filename}</span>}
                  <button className="admin-slide-thumb__del" onClick={() => onRemovePhoto(photo.id)}>×</button>
                </div>
              )
            })}
            <button className="gallery-add-photo" onClick={() => fileInputRef.current?.click()} disabled={!!uploadProgress}>
              <span>{uploadProgress ? `⏳ ${uploadProgress}` : '+'}</span>
              <span>{uploadProgress ? 'Ajout en cours…' : 'Ajouter'}</span>
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: DISPONIBILITÉS
// ═══════════════════════════════════════════════════════════════════════════════
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['L','M','M','J','V','S','D']

function TabDisponibilites() {
  const [busy, setBusy] = useState({})
  const toast = useToast()
  const [offset, setOffset] = useState(0)

  useEffect(() => { dbGetAvailability().then(setBusy) }, [])

  const today = new Date()
  const months = [0,1,2].map(i => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset + i, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const toggleDay = (key) => {
    setBusy(prev => {
      const next = { ...prev }
      if (next[key] === 'busy') delete next[key]
      else next[key] = 'busy'
      return next
    })
  }

  const save = async () => {
    await dbSaveAvailability(busy)
    toast('Disponibilités sauvegardées')
  }

  return (
    <div className="admin-tab">
      <div className="admin-tab__header">
        <div>
          <h2 className="admin-tab__title">📅 Disponibilités</h2>
          <p className="admin-section__desc">Cliquez sur un jour pour le marquer comme complet. Cliquez à nouveau pour le libérer.</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button className="admin-btn admin-btn--ghost" onClick={() => setOffset(o => o - 3)}>‹</button>
          <button className="admin-btn admin-btn--ghost" onClick={() => setOffset(0)}>Aujourd'hui</button>
          <button className="admin-btn admin-btn--ghost" onClick={() => setOffset(o => o + 3)}>›</button>
          <button className="admin-btn admin-btn--solid" onClick={save}>Sauvegarder</button>
        </div>
      </div>

      <div className="avail-admin__months">
        {months.map(({ year, month }) => {
          const firstDay = new Date(year, month, 1)
          const lastDay  = new Date(year, month + 1, 0)
          const startOffset = (firstDay.getDay() + 6) % 7
          const days = []
          for (let i = 0; i < startOffset; i++) days.push(null)
          for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
          return (
            <div key={`${year}-${month}`} className="avail-admin__month">
              <p className="avail-admin__month-name">{MONTHS_FR[month]} {year}</p>
              <div className="avail-admin__grid-head">
                {DAYS_FR.map((d,i) => <span key={i}>{d}</span>)}
              </div>
              <div className="avail-admin__grid">
                {days.map((d, i) => {
                  if (!d) return <span key={`e-${i}`} className="avail-admin__day avail-admin__day--empty" />
                  const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                  const isPast = new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
                  const isBusy = busy[key] === 'busy'
                  return (
                    <button
                      key={key}
                      className={`avail-admin__day ${isPast ? 'avail-admin__day--past' : isBusy ? 'avail-admin__day--busy' : 'avail-admin__day--free'}`}
                      onClick={() => !isPast && toggleDay(key)}
                      disabled={isPast}
                    >{d}</button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SÉCURITÉ
// ═══════════════════════════════════════════════════════════════════════════════
function getPwdStrength(pwd) {
  if (!pwd) return { score: 0, label: '', color: 'transparent' }
  let score = 0
  if (pwd.length >= 8)  score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  const levels = [
    { label: 'Très faible', color: '#e63946' },
    { label: 'Faible',      color: '#e63946' },
    { label: 'Moyen',       color: '#f59e0b' },
    { label: 'Fort',        color: '#4ade80' },
    { label: 'Très fort',   color: '#4ade80' },
    { label: 'Excellent',   color: '#00d4aa' },
  ]
  return { score, ...levels[score] }
}

function parseUA(ua = '') {
  const mobile  = /iPhone|Android.*Mobile/i.test(ua)
  const tablet  = /iPad|Android(?!.*Mobile)/i.test(ua)
  const device  = tablet ? 'Tablette' : mobile ? 'Mobile' : 'Ordinateur'
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : ''
  const os = /Windows/.test(ua) ? 'Windows'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : ''
  return { device, browser, os }
}

function TabSecurite({ autoLogoutMin, setAutoLogoutMin, onLogout }) {
  const [oldPwd, setOldPwd]   = useState('')
  const [newPwd, setNewPwd]   = useState('')
  const [confPwd, setConfPwd] = useState('')
  const [pwdMsg, setPwdMsg]   = useState(null)
  const [logoutMin, setLogoutMin] = useState(autoLogoutMin)

  const changePwd = async (e) => {
    e.preventDefault()
    const stored = getPassword()
    const hashedOld = await hashPassword(oldPwd)
    const oldMatch = stored
      ? (hashedOld === stored || (!isHashed(stored) && oldPwd === stored))
      : false
    if (!oldMatch) { setPwdMsg({ type: 'error', text: 'Ancien mot de passe incorrect.' }); return }
    if (newPwd.length < 4) { setPwdMsg({ type: 'error', text: 'Le nouveau mot de passe doit faire au moins 4 caractères.' }); return }
    if (newPwd !== confPwd) { setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' }); return }
    const h = await savePassword(newPwd)
    dbSaveConfig({ password: h })
    // Update Firebase Auth password
    try {
      const user = auth.currentUser
      if (user) {
        const cred = EmailAuthProvider.credential(ADMIN_EMAIL, oldPwd)
        await reauthenticateWithCredential(user, cred)
        await updatePassword(user, newPwd)
      }
    } catch { /* ignore — Firebase Auth password update is best-effort */ }
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
            {newPwd && (() => {
              const s = getPwdStrength(newPwd)
              return (
                <div className="pwd-strength">
                  <div className="pwd-strength__bar">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="pwd-strength__seg"
                        style={{ background: i <= s.score ? s.color : 'rgba(255,255,255,0.08)' }} />
                    ))}
                  </div>
                  <span className="pwd-strength__label" style={{ color: s.color }}>{s.label}</span>
                </div>
              )
            })()}
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

      <div className="admin-logout-zone">
        <div className="admin-logout-zone__label">Session active</div>
        <button className="admin-logout-btn" onClick={onLogout}>
          <span className="admin-logout-btn__bg" />
          <span className="admin-logout-btn__scan" />
          <span className="admin-logout-btn__content">
            <svg className="admin-logout-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Se déconnecter</span>
          </span>
        </button>
      </div>

      <FirestoreHealth />
      <ConnectedDevices />
      <LoginHistory />
    </div>
  )
}

function FirestoreHealth() {
  const [status, setStatus] = useState(null) // null = not checked yet
  const [loading, setLoading] = useState(false)

  const check = async () => {
    setLoading(true)
    const result = await dbPingFirestore()
    setStatus(result)
    setLoading(false)
  }

  useEffect(() => { check() }, [])

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [])

  const dot = !status ? '#666'
    : !status.ok ? '#e63946'
    : status.ms < 300 ? '#4ade80'
    : status.ms < 800 ? '#f59e0b'
    : '#e63946'

  const label = !status ? 'Vérification…'
    : !status.ok ? 'Hors ligne'
    : status.ms < 300 ? 'Excellent'
    : status.ms < 800 ? 'Correct'
    : 'Lent'

  return (
    <div className="admin-fields-group">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="admin-group-title" style={{ border: 'none', paddingBottom: 0 }}>État de santé Firebase</h3>
        <button className="admin-btn-sm" onClick={check} disabled={loading}>
          {loading ? '…' : 'Actualiser'}
        </button>
      </div>
      <div className="health-row">
        <span className="health-dot" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
        <span className="health-service">Firestore</span>
        <span className="health-label" style={{ color: dot }}>{label}</span>
        {status?.ok && <span className="health-ms">{status.ms} ms</span>}
      </div>
    </div>
  )
}

function ConnectedDevices() {
  const [sessions, setSessions] = useState([])
  const currentId = localStorage.getItem('yenou_session_id')

  useEffect(() => { dbGetSessions().then(setSessions) }, [])

  const revoke = async (id) => {
    await dbDeleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  const fmt = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="admin-fields-group">
      <h3 className="admin-group-title">Appareils connectés</h3>
      {sessions.length === 0 ? (
        <p className="admin-hint">Aucune session enregistrée.</p>
      ) : (
        <div className="devices-list">
          {sessions.map(s => {
            const { device, browser, os } = parseUA(s.ua)
            const isCurrent = s.id === currentId
            return (
              <div key={s.id} className={`device-row ${isCurrent ? 'device-row--current' : ''}`}>
                <div className="device-icon">
                  {device === 'Mobile' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>
                  ) : device === 'Tablette' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="22" x2="16" y2="22"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
                  )}
                </div>
                <div className="device-info">
                  <span className="device-name">{device}{browser ? ` · ${browser}` : ''}{os ? ` · ${os}` : ''}</span>
                  <span className="device-date">{fmt(s.loginAt)}</span>
                </div>
                {isCurrent
                  ? <span className="device-current">Session actuelle</span>
                  : <button className="admin-btn-sm admin-btn-sm--delete" onClick={() => revoke(s.id)}>Révoquer</button>
                }
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LoginHistory() {
  const [history, setHistory] = useState([])

  useEffect(() => {
    dbGetLoginHistory().then(setHistory)
  }, [])

  const clear = async () => {
    await dbClearLoginHistory()
    setHistory([])
  }

  const fmt = (ts) => {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `Aujourd'hui ${time}`
    if (isYesterday) return `Hier ${time}`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + time
  }

  return (
    <div className="admin-fields-group">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="admin-group-title" style={{ border: 'none', paddingBottom: 0 }}>Tentatives de connexion échouées</h3>
        {history.length > 0 && (
          <button className="admin-btn-sm admin-btn-sm--delete" onClick={clear}>Effacer</button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="admin-hint">Aucune tentative échouée enregistrée.</p>
      ) : (
        <table className="login-history-table">
          <thead>
            <tr>
              <th>Date / heure</th>
              <th>Essai n°</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i}>
                <td>{fmt(h.at)}</td>
                <td>{h.attempt}</td>
                <td className={h.locked ? 'login-history__locked' : 'login-history__fail'}>
                  {h.locked ? '🔒 Bloqué 15 min' : '✗ Échec'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
