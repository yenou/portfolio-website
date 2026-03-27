import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, increment } from 'firebase/firestore'
import { db } from '../firebase'

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

// ── Firestore document/collection refs ───────────────────────────────────────
const configDoc        = doc(db, 'site', 'config')
const photosDoc        = doc(db, 'site', 'photos')
const visitsDoc        = doc(db, 'site', 'visits')
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
      if (d.password)     { setLS(K.PASSWORD, d.password);         updated = true }
      if (d.hiddenIds)    { setLS(K.HIDDEN, d.hiddenIds);          updated = true }
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

    // About + logo (stored as base64 in site/photos)
    const photosSnap = await getDoc(photosDoc)
    if (photosSnap.exists()) {
      const d = photosSnap.data()
      if (d.aboutImg)  { setLS(K.ABOUT_IMG, d.aboutImg);  updated = true }
      if (d.logoImg)   { setLS(K.LOGO_IMG,  d.logoImg);   updated = true }
    }

    // Custom portfolio photos (each in own document)
    const photosSnap2 = await getDocs(customPhotosCol)
    if (!photosSnap2.empty) {
      const photos = photosSnap2.docs.map(d => d.data()).sort((a, b) => a.id - b.id)
      setLS(K.PHOTOS, photos); updated = true
    }

    // Hero slideshow (each slide in own document)
    const slidesSnap = await getDocs(heroSlidesCol)
    if (!slidesSnap.empty) {
      const slides = slidesSnap.docs.map(d => d.data()).sort((a, b) => a._order - b._order)
      setLS(K.HERO_IMGS, slides); updated = true
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

// ── Save a single custom portfolio photo ──────────────────────────────────────
export async function dbSaveCustomPhoto(photo) {
  try { await setDoc(doc(customPhotosCol, String(photo.id)), photo) }
  catch (e) { console.warn('[Firebase] Custom photo save failed:', e.message) }
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

// ── Save all hero slides (full replace) ───────────────────────────────────────
export async function dbSaveAllHeroSlides(slides) {
  try {
    // Delete all existing slides first
    const snap = await getDocs(heroSlidesCol)
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
    // Save new slides
    await Promise.all(slides.map((s, i) =>
      setDoc(doc(heroSlidesCol, String(s._id || i)), { ...s, _order: i })
    ))
  } catch (e) { console.warn('[Firebase] Hero slides save failed:', e.message) }
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

export async function dbGetAllGalleries() {
  try {
    const snap = await getDocs(clientGalleriesCol)
    return snap.docs.map(d => d.data()).sort((a, b) => b.createdAt - a.createdAt)
  } catch (e) { return [] }
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
