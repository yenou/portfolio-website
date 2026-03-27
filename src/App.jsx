import { useEffect, useState, useRef } from 'react'
import Cursor from './components/Cursor'
import Loader from './components/Loader'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Portfolio from './components/Portfolio'
import About from './components/About'
import Services from './components/Services'
import Testimonials from './components/Testimonials'
import Contact from './components/Contact'
import Footer from './components/Footer'
import Banner from './components/Banner'
import Admin from './pages/Admin'
import ClientGallery from './pages/ClientGallery'
import { incrementVisits } from './utils/storage'
import { syncFromFirestore, syncPhotosFromFirestore, dbIncrementVisit } from './utils/db'

function isAdminRoute() {
  return window.location.pathname === '/admin' || window.location.hash === '#admin'
}

function isGalleryRoute() {
  return window.location.pathname.startsWith('/galerie/')
}

export default function App() {
  const [loaderDone, setLoaderDone]   = useState(false)
  const [syncDone, setSyncDone]       = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showAdmin, setShowAdmin]     = useState(isAdminRoute)
  const [showGallery] = useState(isGalleryRoute)
  const visitedRef = useRef(false)

  useEffect(() => {
    Promise.all([syncFromFirestore(), syncPhotosFromFirestore()]).finally(() => setSyncDone(true))
    if (!visitedRef.current) {
      visitedRef.current = true
      incrementVisits()
      dbIncrementVisit()
    }
  }, [])

  // Écoute les changements d'URL
  useEffect(() => {
    const onHash = () => setShowAdmin(isAdminRoute())
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  const exitAdmin = () => {
    window.location.hash = ''
    setShowAdmin(false)
  }

  // Scroll progress bar + show-top button
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const progress = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
      setScrollProgress(progress)
      setShowScrollTop(el.scrollTop > 500)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll reveal
  useEffect(() => {
    if (!loaderDone || showAdmin) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08 }
    )
    const els = document.querySelectorAll('.reveal')
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [loaderDone, showAdmin])

  // Page galerie client
  if (showGallery) {
    return (
      <>
        <Cursor />
        <ClientGallery />
      </>
    )
  }

  // Page admin
  if (showAdmin) {
    return (
      <>
        <Cursor />
        <Admin onExit={exitAdmin} />
      </>
    )
  }

  return (
    <>
      <Banner />
      <Cursor />
      {(!loaderDone || !syncDone) && <Loader onDone={() => setLoaderDone(true)} syncDone={syncDone} />}
      <div className="scroll-progress" style={{ width: `${scrollProgress}%` }} />
      {showScrollTop && (
        <button className="scroll-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Remonter en haut">↑</button>
      )}
      <Navbar />
      <main>
        <Hero />
        <Portfolio />
        <About />
        <Services />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
