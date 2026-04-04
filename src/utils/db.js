import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, increment, updateDoc, deleteField } from 'firebase/firestore'
import { db, auth } from '../firebase'

const CLOUDINARY_CLOUD = 'dc6hknkqp'
const CLOUDINARY_PRESET = 'yenou_portfolio'

async function uploadToCloudinary(base64) {
  const formData = new FormData()
  formData.append('file', base64)
  formData.append('upload_preset', CLOUDINARY_PRESET)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST',
    body: formData
  })
  if (!res.ok) throw new Error('Cloudinary upload failed')
  const data = await res.json()
  return data.secure_url
}
import { cachePhotosInMemory, cacheHeroImgsInMemory, isHashed, hashPassword } from './storage'

// ── LocalStorage keys (same as storage.js) ───────────────────────────────────
const K = {
  TEXTS:        'yenou_texts',
  CONTACT:      'yenou_contact',
  SERVICES:     'yenou_services',
  TESTIMONIALS: 'yenou_testimonials',
  PASSWORD:     'yenou_password',
  HIDDEN:       'yenou_hidden_photos',
  COUPS_DE_COEUR: 'yenou_coups_de_coeur',
  HERO_IMG:     'yenou_hero_img',
  ABOUT_IMG:    'yenou_about_img',
  PHOTOS:       'yenou_portfolio_photos',
  BANNER:       'yenou_banner',
  HERO_IMGS:    'yenou_hero_imgs',
  LOGO_IMG:     'yenou_logo_img',
}
const setLS = (key, val) => localStorage.setItem(key, JSON.stringify(val))

// ── Firestore document/collection refs ───────────────────────────────────────
const configDoc        = doc(db, 'site', 'config')
const photosDoc        = doc(db, 'site', 'photos')
const visitsDoc        = doc(db, 'site', 'visits')
const loginAttemptsDoc = doc(db, 'site', 'loginAttempts')
const customPhotosCol  = collection(db, 'customPhotos')
const heroSlidesCol    = collection(db, 'heroSlides')

// ── Sync FROM Firestore → localStorage on startup ─────────────────────────────
export async function syncFromFirestore() {
  try {
    const configSnap = await getDoc(configDoc)
    let updated = false
    if (configSnap.exists()) {
      const d = configSnap.data()
      if (d.texts)        { setLS(K.TEXTS, d.texts);               updated = true }
      if (d.contact)      { setLS(K.CONTACT, d.contact);           updated = true }
      if (d.services)     { setLS(K.SERVICES, d.services);         updated = true }
      if (d.testimonials) { setLS(K.TESTIMONIALS, d.testimonials); updated = true }
      // Sync password only if no local hash exists (one-time bootstrap for fresh browser)
      // Removed from Firestore after first successful login via dbRemovePassword()
      if (d.password && !localStorage.getItem('yenou_password')) {
        const hashed = isHashed(d.password) ? d.password : await hashPassword(d.password)
        setLS(K.PASSWORD, hashed)
      }
      if (d.hiddenIds)    { setLS(K.HIDDEN, d.hiddenIds);                    updated = true }
      if (d.coupsDeCoeur) { setLS(K.COUPS_DE_COEUR, d.coupsDeCoeur);         updated = true }
      if (d.banner)       { setLS(K.BANNER, d.banner);             updated = true }
    }
    if (updated) window.dispatchEvent(new CustomEvent('yenou:updated'))
  } catch (e) {
    console.warn('[Firebase] Sync failed, using local cache:', e.message)
  }
}

// ── Sync photos FROM Firestore → localStorage on startup ──────────────────────
export async function syncPhotosFromFirestore() {
  try {
    let updated = false

    // Forcer la suppression du cache hero stale avant de syncer
    localStorage.removeItem(K.HERO_IMGS)
    localStorage.removeItem(K.HERO_IMG)

    // About + logo (stored as base64 in site/photos)
    const photosSnap = await getDoc(photosDoc)
    if (photosSnap.exists()) {
      const d = photosSnap.data()
      if (d.aboutImg)  { setLS(K.ABOUT_IMG, d.aboutImg);  updated = true }
      if (d.logoImg)   { setLS(K.LOGO_IMG,  d.logoImg);   updated = true }
    }

    // Custom portfolio photos (each in own document)
    localStorage.removeItem('yenou_portfolio_photos')
    const photosSnap2 = await getDocs(customPhotosCol)
    if (!photosSnap2.empty) {
      const photos = photosSnap2.docs.map(d => d.data()).sort((a, b) => a.id - b.id)
      cachePhotosInMemory(photos)
      try { setLS(K.PHOTOS, photos) } catch { /* localStorage plein — cache mémoire utilisé */ }
      updated = true
    }

    // Hero slideshow (each slide in own document)
    const slidesSnap = await getDocs(heroSlidesCol)
    if (!slidesSnap.empty) {
      const slides = slidesSnap.docs.map(d => d.data()).sort((a, b) => a._order - b._order)
      cacheHeroImgsInMemory(slides)
      try { setLS(K.HERO_IMGS, slides) } catch { /* localStorage plein — cache mémoire utilisé */ }
      updated = true
    }

    if (updated) window.dispatchEvent(new CustomEvent('yenou:updated'))
  } catch (e) {
    console.warn('[Firebase] Photos sync failed:', e.message)
  }
}

// ── Save config to Firestore ──────────────────────────────────────────────────
export async function dbSaveConfig(data) {
  try { await setDoc(configDoc, data, { merge: true }) }
  catch (e) { console.warn('[Firebase] Config save failed:', e.message) }
}

// ── Save about/logo base64 to Firestore ───────────────────────────────────────
export async function dbSaveAboutImg(base64) {
  try { await setDoc(photosDoc, { aboutImg: base64 }, { merge: true }) }
  catch (e) { console.warn('[Firebase] About img save failed:', e.message) }
}

export async function dbSaveLogoImg(base64) {
  try { await setDoc(photosDoc, { logoImg: base64 }, { merge: true }) }
  catch (e) { console.warn('[Firebase] Logo img save failed:', e.message) }
}

// ── Save a single custom portfolio photo (upload to Cloudinary, save URL to Firestore) ─
export async function dbSaveCustomPhoto(photo) {
  const url = await uploadToCloudinary(photo.src)
  const photoData = { ...photo, src: url }
  await setDoc(doc(customPhotosCol, String(photo.id)), photoData)
  return photoData
}

// ── Migrate base64 photos to Cloudinary (one-time, runs silently on admin login) ─
export async function dbMigrateBase64ToCloudinary() {
  try {
    const snap = await getDocs(customPhotosCol)
    const base64Photos = snap.docs.map(d => d.data()).filter(p => p.src?.startsWith('data:image'))
    for (const photo of base64Photos) {
      const url = await uploadToCloudinary(photo.src)
      await setDoc(doc(customPhotosCol, String(photo.id)), { ...photo, src: url })
    }
    if (base64Photos.length > 0) console.info(`[Migration] ${base64Photos.length} photo(s) migrées vers Cloudinary`)
  } catch (e) { console.warn('[Migration] Échec:', e.message) }
}

// ── Delete a custom portfolio photo ───────────────────────────────────────────
export async function dbDeleteCustomPhoto(id) {
  try { await deleteDoc(doc(customPhotosCol, String(id))) }
  catch (e) { console.warn('[Firebase] Custom photo delete failed:', e.message) }
}

// ── Save a hero slide ──────────────────────────────────────────────────────────
export async function dbSaveHeroSlide(slide, order) {
  try { await setDoc(doc(heroSlidesCol, String(slide._id)), { ...slide, _order: order }) }
  catch (e) { console.warn('[Firebase] Hero slide save failed:', e.message) }
}

// ── Delete a hero slide ────────────────────────────────────────────────────────
export async function dbDeleteHeroSlide(id) {
  try { await deleteDoc(doc(heroSlidesCol, String(id))) }
  catch (e) { console.warn('[Firebase] Hero slide delete failed:', e.message) }
}

// ── Save all hero slides (full replace, upload base64 to Cloudinary) ─────────
export async function dbSaveAllHeroSlides(slides) {
  try {
    const snap = await getDocs(heroSlidesCol)
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
    await Promise.all(slides.map(async (s, i) => {
      let src = s.src
      if (src && src.startsWith('data:image')) {
        src = await uploadToCloudinary(src)
      }
      await setDoc(doc(heroSlidesCol, String(s._id || i)), { ...s, src, _order: i })
    }))
  } catch (e) { console.warn('[Firebase] Hero slides save failed:', e.message) }
}

// ── Migrate base64 hero slides to Cloudinary (one-time, runs silently on admin login) ─
export async function dbMigrateHeroSlidesToCloudinary() {
  try {
    const snap = await getDocs(heroSlidesCol)
    const base64Slides = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.src?.startsWith('data:image'))
    for (const slide of base64Slides) {
      const url = await uploadToCloudinary(slide.src)
      await setDoc(doc(heroSlidesCol, slide.id), { ...slide, src: url })
    }
    if (base64Slides.length > 0) console.info(`[Migration] ${base64Slides.length} slide(s) hero migrée(s) vers Cloudinary`)
  } catch (e) { console.warn('[Migration Hero] Échec:', e.message) }
}

// ── Increment today's visit count in Firestore ────────────────────────────────
export async function dbIncrementVisit() {
  const today = new Date().toISOString().slice(0, 10)
  try { await setDoc(visitsDoc, { [today]: increment(1) }, { merge: true }) }
  catch (e) { /* silent */ }
}

// ── Get full visit history from Firestore ─────────────────────────────────────
export async function dbGetVisitHistory() {
  try {
    const snap = await getDoc(visitsDoc)
    return snap.exists() ? snap.data() : {}
  } catch (e) { return {} }
}

// ── Client Galleries ───────────────────────────────────────────────────────────
const clientGalleriesCol = collection(db, 'clientGalleries')
const clientGalleryPhotosCol = collection(db, 'clientGalleryPhotos')

export async function dbCreateGallery(gallery) {
  // gallery = { code, clientName, createdAt }
  try { await setDoc(doc(clientGalleriesCol, gallery.code), gallery) }
  catch (e) { console.warn('[Firebase] Gallery create failed:', e.message) }
}

export async function dbDeleteGallery(code) {
  try {
    await deleteDoc(doc(clientGalleriesCol, code))
    // delete all photos for this gallery
    const snap = await getDocs(clientGalleryPhotosCol)
    await Promise.all(snap.docs.filter(d => d.data().galleryCode === code).map(d => deleteDoc(d.ref)))
  } catch (e) { console.warn('[Firebase] Gallery delete failed:', e.message) }
}

export async function dbAddGalleryPhoto(photo) {
  // photo = { id, galleryCode, src, caption, order }
  try { await setDoc(doc(clientGalleryPhotosCol, String(photo.id)), photo) }
  catch (e) { console.warn('[Firebase] Gallery photo add failed:', e.message) }
}

export async function dbDeleteGalleryPhoto(id) {
  try { await deleteDoc(doc(clientGalleryPhotosCol, String(id))) }
  catch (e) { console.warn('[Firebase] Gallery photo delete failed:', e.message) }
}

export async function dbIncrementGalleryView(code) {
  try {
    await setDoc(doc(clientGalleriesCol, code), { views: increment(1), lastView: Date.now() }, { merge: true })
  } catch (e) { /* silent */ }
}

export async function dbSaveGallerySelection(code, selectedPhotoIds) {
  try {
    await setDoc(doc(clientGalleriesCol, code), {
      selectedPhotos: selectedPhotoIds,
      selectionValidated: selectedPhotoIds.length > 0,
      validatedAt: selectedPhotoIds.length > 0 ? Date.now() : null
    }, { merge: true })
  } catch (e) { console.warn('[Firebase] Gallery selection save failed:', e.message) }
}

export async function dbGetAllGalleries() {
  try {
    const [galSnap, photosSnap] = await Promise.all([getDocs(clientGalleriesCol), getDocs(clientGalleryPhotosCol)])
    const allPhotos = photosSnap.docs.map(d => d.data())
    return galSnap.docs
      .map(d => d.data())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(g => ({ ...g, photos: allPhotos.filter(p => p.galleryCode === g.code).sort((a, b) => a.order - b.order) }))
  } catch (e) { return [] }
}

// ── Disponibilités ────────────────────────────────────────────────────────────
const availabilityDoc = doc(db, 'site', 'availability')

export async function dbGetAvailability() {
  try {
    const snap = await getDoc(availabilityDoc)
    return snap.exists() ? snap.data() : {}
  } catch (e) { return {} }
}

export async function dbSaveAvailability(data) {
  try { await setDoc(availabilityDoc, data) }
  catch (e) { console.warn('[Firebase] Availability save failed:', e.message) }
}

// ── Photo likes ───────────────────────────────────────────────────────────────
const photoLikesDoc = doc(db, 'site', 'photoLikes')

export async function dbGetPhotoLikes() {
  try {
    const snap = await getDoc(photoLikesDoc)
    return snap.exists() ? snap.data() : {}
  } catch (e) { return {} }
}

export async function dbLikePhoto(photoId) {
  try { await setDoc(photoLikesDoc, { [photoId]: increment(1) }, { merge: true }) }
  catch (e) { console.warn('[Firebase] Like failed:', e.message) }
}

export async function dbUnlikePhoto(photoId) {
  try { await setDoc(photoLikesDoc, { [photoId]: increment(-1) }, { merge: true }) }
  catch (e) { console.warn('[Firebase] Unlike failed:', e.message) }
}

export async function dbGetGallery(code) {
  try {
    const gallerySnap = await getDoc(doc(clientGalleriesCol, code))
    if (!gallerySnap.exists()) return null
    const gallery = gallerySnap.data()
    const photosSnap = await getDocs(clientGalleryPhotosCol)
    const photos = photosSnap.docs
      .map(d => d.data())
      .filter(p => p.galleryCode === code)
      .sort((a, b) => a.order - b.order)
    return { ...gallery, photos }
  } catch (e) { return null }
}

// ── Firestore lockout (server-side, unbypassable) ────────────────────────────
export async function dbGetLockoutState() {
  try {
    const snap = await getDoc(loginAttemptsDoc)
    if (!snap.exists()) return {}
    const d = snap.data()
    return { attempts: d.attempts || 0, lockedUntil: d.lockedUntil || null }
  } catch (e) { return {} }
}

export async function dbSetLockoutState(state) {
  try {
    const snap = await getDoc(loginAttemptsDoc)
    const history = snap.exists() ? (snap.data().history || []) : []
    await setDoc(loginAttemptsDoc, {
      history,
      attempts: state.attempts ?? 0,
      lockedUntil: state.lockedUntil ?? null,
    })
  } catch (e) { console.warn('[Firebase] lockout save failed:', e.message) }
}

export async function dbAddLoginAttempt(entry) {
  try {
    const snap = await getDoc(loginAttemptsDoc)
    const history = snap.exists() ? (snap.data().history || []) : []
    const next = [entry, ...history].slice(0, 20)
    const d = snap.exists() ? snap.data() : {}
    await setDoc(loginAttemptsDoc, { ...d, history: next })
  } catch (e) { console.warn('[Firebase] loginAttempt save failed:', e.message) }
}

export async function dbGetLoginHistory() {
  try {
    const snap = await getDoc(loginAttemptsDoc)
    return snap.exists() ? (snap.data().history || []) : []
  } catch (e) { return [] }
}

export async function dbClearLoginHistory() {
  try { await setDoc(loginAttemptsDoc, { history: [] }) }
  catch (e) { console.warn('[Firebase] clear history failed:', e.message) }
}

// ── Firestore latency ping ────────────────────────────────────────────────────
export async function dbPingFirestore() {
  const start = performance.now()
  try {
    await getDoc(configDoc)
    return { ok: true, ms: Math.round(performance.now() - start) }
  } catch (e) {
    return { ok: false, ms: null }
  }
}

// ── Admin sessions ────────────────────────────────────────────────────────────
const adminSessionsDoc = doc(db, 'site', 'adminSessions')

export async function dbCreateSession(session) {
  try {
    const snap = await getDoc(adminSessionsDoc)
    const sessions = snap.exists() ? (snap.data().list || []) : []
    // Keep last 10 sessions only
    const next = [session, ...sessions].slice(0, 10)
    await setDoc(adminSessionsDoc, { list: next })
  } catch (e) { /* silent */ }
}

export async function dbGetSessions() {
  try {
    const snap = await getDoc(adminSessionsDoc)
    return snap.exists() ? (snap.data().list || []) : []
  } catch (e) { return [] }
}

export async function dbDeleteSession(sessionId) {
  try {
    const snap = await getDoc(adminSessionsDoc)
    const sessions = snap.exists() ? (snap.data().list || []) : []
    await setDoc(adminSessionsDoc, { list: sessions.filter(s => s.id !== sessionId) })
  } catch (e) { /* silent */ }
}

// ── Remove password field from Firestore (one-time security migration) ────────
export async function dbRemovePassword() {
  try { await updateDoc(configDoc, { password: deleteField() }) }
  catch (e) { /* silent — field may already be absent */ }
}
