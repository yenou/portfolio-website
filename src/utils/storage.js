// All storage keys and helpers for the admin
import { useState, useEffect } from 'react'

// Hook to reactively read storage — re-renders when admin saves
export function useStorage(getter) {
  const [value, setValue] = useState(getter)
  useEffect(() => {
    const handler = () => setValue(getter())
    window.addEventListener('yenou:updated', handler)
    return () => window.removeEventListener('yenou:updated', handler)
  }, [])
  return value
}

const KEYS = {
  PHOTOS: 'yenou_portfolio_photos',
  HIDDEN: 'yenou_hidden_photos',
  COUPS_DE_COEUR: 'yenou_coups_de_coeur',
  PHOTO_ORDER: 'yenou_photo_order',
  TEXTS: 'yenou_texts',
  TESTIMONIALS: 'yenou_testimonials',
  SERVICES: 'yenou_services',
  CONTACT: 'yenou_contact',
  PASSWORD: 'yenou_password',
  VISITS: 'yenou_visits',
  HERO_IMG: 'yenou_hero_img',
  HERO_IMGS: 'yenou_hero_imgs',
  ABOUT_IMG: 'yenou_about_img',
  LAST_ACTIVE: 'yenou_last_active',
  BANNER: 'yenou_banner',
  LOGO_IMG: 'yenou_logo_img',
}

function get(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}
function set(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('yenou:updated'))
}

// Photos
export const getCustomPhotos = () => get(KEYS.PHOTOS, [])
export const saveCustomPhotos = (v) => set(KEYS.PHOTOS, v)
export const getHiddenIds = () => get(KEYS.HIDDEN, [])
export const saveHiddenIds = (v) => set(KEYS.HIDDEN, v)
export const getCoupsDeCoeur = () => get(KEYS.COUPS_DE_COEUR, [])
export const saveCoupsDeCoeur = (v) => set(KEYS.COUPS_DE_COEUR, v)
export const getPhotoOrder = () => get(KEYS.PHOTO_ORDER, [])
export const savePhotoOrder = (v) => set(KEYS.PHOTO_ORDER, v)

// Hero & About images
export const getHeroImg = () => get(KEYS.HERO_IMG, null)
export const saveHeroImg = (v) => set(KEYS.HERO_IMG, v)
export const getHeroImgs = () => get(KEYS.HERO_IMGS, [])
export const saveHeroImgs = (v) => set(KEYS.HERO_IMGS, v)
export const getAboutImg = () => get(KEYS.ABOUT_IMG, null)
export const saveAboutImg = (v) => set(KEYS.ABOUT_IMG, v)

// Texts
const DEFAULT_TEXTS = {
  heroEyebrow: 'Photographe professionnel',
  heroTagline: "Capturer l'instant. Révéler l'émotion.",
  aboutQuote: "La photographie, c'est fixer l'éternité dans un fragment de seconde.",
  aboutP1: "Depuis plus de vingt ans, je parcours les paysages vosgiens et les scènes de vie avec mon objectif pour capturer ce que les mots ne peuvent exprimer. La photographie n'est pas pour moi un simple métier — c'est une vocation, une façon d'être au monde.",
  aboutP2: "Basé à Contrexéville, au cœur des Vosges, je puise mon inspiration dans la beauté des paysages naturels qui m'entourent, tout en cultivant une sensibilité particulière pour les portraits humains et l'énergie des événements en direct.",
  aboutP3: "Chaque déclenchement est une conversation silencieuse entre le photographe et son sujet. Mon approche est à la fois discrète et attentive — pour que chaque image raconte une histoire vraie.",
}
export const getTexts = () => ({ ...DEFAULT_TEXTS, ...get(KEYS.TEXTS, {}) })
export const saveTexts = (v) => set(KEYS.TEXTS, v)

// Testimonials
const DEFAULT_TESTIMONIALS = [
  { id: 1, name: 'Sophie M.', context: 'Séance famille', text: "André a su mettre toute ma famille à l'aise dès les premières minutes. Les photos sont d'une beauté exceptionnelle.", stars: 5 },
  { id: 2, name: 'Thomas R.', context: 'Reportage concert', text: "Nous avons fait appel à André pour photographier notre festival. Le résultat est bluffant : il a saisi l'énergie de la scène avec un œil remarquable.", stars: 5 },
  { id: 3, name: 'Claire & Julien', context: 'Portraits', text: "Une expérience formidable du début à la fin. André est attentif, créatif et professionnel. Nos portraits sont magnifiques.", stars: 5 },
]
export const getTestimonials = () => get(KEYS.TESTIMONIALS, DEFAULT_TESTIMONIALS)
export const saveTestimonials = (v) => set(KEYS.TESTIMONIALS, v)

// Services
const DEFAULT_SERVICES = [
  { id: 1, title: 'Portraits & Famille', description: 'Séances photo personnalisées pour sublimer votre personnalité ou immortaliser les moments en famille. En studio ou en extérieur, dans une atmosphère naturelle et détendue.', details: ['Portrait individuel', 'Séance famille', 'En studio ou extérieur', 'Retouches incluses'] },
  { id: 3, title: 'Concerts & Événements', description: "Reportage photo lors de vos concerts, festivals ou événements privés. Capture de l'énergie, de l'ambiance et des moments forts qui marquent les esprits.", details: ['Concerts & festivals', 'Événements privés', 'Livraison rapide', 'Galerie en ligne'] },
]
export const getServices = () => get(KEYS.SERVICES, DEFAULT_SERVICES)
export const saveServices = (v) => set(KEYS.SERVICES, v)

// Contact
const DEFAULT_CONTACT = {
  email: 'yenouandre@gmail.com',
  phone: '09 52 80 69 91',
  location: 'Contrexéville, Vosges',
  facebook: 'https://www.facebook.com/ayenouphoto/',
  facebookHandle: 'ayenouphoto',
}
export const getContact = () => ({ ...DEFAULT_CONTACT, ...get(KEYS.CONTACT, {}) })
export const saveContact = (v) => set(KEYS.CONTACT, v)

// Password (stored as SHA-256 hash)
export async function hashPassword(pwd) {
  const buf = new TextEncoder().encode(pwd)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
export function isHashed(str) {
  return typeof str === 'string' && str.length === 64 && /^[0-9a-f]+$/.test(str)
}
export const getPassword = () => get(KEYS.PASSWORD, null)
export async function savePassword(v) {
  const hashed = isHashed(v) ? v : await hashPassword(v)
  set(KEYS.PASSWORD, hashed)
  return hashed
}

// Visits
export const getVisits = () => get(KEYS.VISITS, 0)
export const incrementVisits = () => set(KEYS.VISITS, getVisits() + 1)

// Last active (for auto-logout)
export const getLastActive = () => get(KEYS.LAST_ACTIVE, Date.now())
export const updateLastActive = () => set(KEYS.LAST_ACTIVE, Date.now())

// Banner
const DEFAULT_BANNER = { enabled: false, text: '', link: '', linkLabel: 'En savoir plus' }
export const getBanner = () => ({ ...DEFAULT_BANNER, ...get(KEYS.BANNER, {}) })
export const saveBanner = (v) => set(KEYS.BANNER, v)

// Logo
export const getLogoImg = () => get(KEYS.LOGO_IMG, null)
export const saveLogoImg = (v) => set(KEYS.LOGO_IMG, v)
