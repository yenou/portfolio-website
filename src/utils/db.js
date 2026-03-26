import { doc, getDoc, setDoc, increment } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'

// ── LocalStorage keys (same as storage.js) ───────────────────────────────────
const K = {
  TEXTS:        'yenou_texts',
  CONTACT:      'yenou_contact',
  SERVICES:     'yenou_services',
  TESTIMONIALS: 'yenou_testimonials',
  PASSWORD:     'yenou_password',
  HIDDEN:       'yenou_hidden_photos',
  HERO_IMG:     'yenou_hero_img',
  ABOUT_IMG:    'yenou_about_img',
  PHOTOS:       'yenou_portfolio_photos',
  BANNER:       'yenou_banner',
  HERO_IMGS:    'yenou_hero_imgs',
  LOGO_IMG:     'yenou_logo_img',
}
const setLS = (key, val) => localStorage.setItem(key, JSON.stringify(val))

// ── Firestore document refs ───────────────────────────────────────────────────
const configDoc = doc(db, 'site', 'config')
const photosDoc = doc(db, 'site', 'photos')
const visitsDoc = doc(db, 'site', 'visits')

// ── Convert base64 data URL to Blob ───────────────────────────────────────────
function base64ToBlob(dataurl) {
  const [header, data] = dataurl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(data)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// ── Upload image to Firebase Storage, return download URL ─────────────────────
async function uploadImg(base64, path) {
  const blob = base64ToBlob(base64)
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob)
  return await getDownloadURL(storageRef)
}

// ── Sync FROM Firestore → localStorage on startup ─────────────────────────────
// Ne synchronise que les données texte — les photos sont gérées localement
// pour éviter d'écraser des photos ajoutées pendant le chargement
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
      if (d.password)     { setLS(K.PASSWORD, d.password);         updated = true }
      if (d.hiddenIds)    { setLS(K.HIDDEN, d.hiddenIds);          updated = true }
      if (d.banner)       { setLS(K.BANNER, d.banner);             updated = true }
    }

    if (updated) window.dispatchEvent(new CustomEvent('yenou:updated'))
  } catch (e) {
    console.warn('[Firebase] Sync failed, using local cache:', e.message)
  }
}

// ── Sync photos FROM Firestore (appel explicite depuis admin) ─────────────────
export async function syncPhotosFromFirestore() {
  try {
    const photosSnap = await getDoc(photosDoc)
    if (!photosSnap.exists()) return
    const d = photosSnap.data()
    let updated = false
    if (d.heroImgUrl)            { setLS(K.HERO_IMG, d.heroImgUrl);   updated = true }
    if (d.aboutImgUrl)           { setLS(K.ABOUT_IMG, d.aboutImgUrl); updated = true }
    if (Array.isArray(d.heroImgs) && d.heroImgs.length > 0) {
      setLS(K.HERO_IMGS, d.heroImgs); updated = true
    }
    if (Array.isArray(d.customPhotos) && d.customPhotos.length > 0) {
      setLS(K.PHOTOS, d.customPhotos); updated = true
    }
    if (d.logoImgUrl) { setLS(K.LOGO_IMG, d.logoImgUrl); updated = true }
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

// ── Save photos metadata to Firestore ────────────────────────────────────────
export async function dbSavePhotos(data) {
  try { await setDoc(photosDoc, data, { merge: true }) }
  catch (e) { console.warn('[Firebase] Photos save failed:', e.message) }
}

// ── Upload hero image to Storage + save URL to Firestore ──────────────────────
export async function dbUploadHeroImg(base64) {
  const url = await uploadImg(base64, 'images/hero.jpg')
  await dbSavePhotos({ heroImgUrl: url })
  return url
}

// ── Upload a hero slideshow image ─────────────────────────────────────────────
export async function dbUploadHeroSlideImg(base64, id) {
  return await uploadImg(base64, `images/hero/slide_${id}.jpg`)
}

// ── Upload logo to Storage + save URL to Firestore ────────────────────────────
export async function dbUploadLogoImg(base64) {
  const url = await uploadImg(base64, 'images/logo.png')
  await dbSavePhotos({ logoImgUrl: url })
  return url
}

// ── Upload about image to Storage + save URL to Firestore ─────────────────────
export async function dbUploadAboutImg(base64) {
  const url = await uploadImg(base64, 'images/about.jpg')
  await dbSavePhotos({ aboutImgUrl: url })
  return url
}

// ── Upload portfolio photo to Storage, return URL ─────────────────────────────
export async function dbUploadPortfolioImg(base64, id) {
  return await uploadImg(base64, `images/portfolio/custom_${id}.jpg`)
}

// ── Increment today's visit count in Firestore ────────────────────────────────
export async function dbIncrementVisit() {
  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
  try { await setDoc(visitsDoc, { [today]: increment(1) }, { merge: true }) }
  catch (e) { /* silent — don't block the visitor */ }
}

// ── Get full visit history from Firestore ─────────────────────────────────────
export async function dbGetVisitHistory() {
  try {
    const snap = await getDoc(visitsDoc)
    return snap.exists() ? snap.data() : {}
  } catch (e) {
    return {}
  }
}
