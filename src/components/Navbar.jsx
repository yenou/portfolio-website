import { useState, useEffect } from 'react'
import './Navbar.css'
import { getLogoImg, useStorage } from '../utils/storage'

const navLinks = [
  { label: 'Accueil',      href: '#accueil' },
  { label: 'Portfolio',    href: '#portfolio' },
  { label: 'À propos',     href: '#apropos' },
  { label: 'Services',     href: '#services' },
  { label: 'Témoignages',    href: '#temoignages' },
  { label: 'Disponibilités', href: '#disponibilites' },
  { label: 'Contact',        href: '#contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const logoImg = useStorage(getLogoImg)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Bloquer le scroll quand le menu est ouvert
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const close = () => setMenuOpen(false)

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <div className="navbar__logo">
          <a href="#accueil" onClick={close}>
            <span className="navbar__logo-signature">YENOU André</span>
          </a>
        </div>

        {/* Liens desktop */}
        <ul className="navbar__links">
          {navLinks.map(link => (
            <li key={link.label}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>

        {/* Burger */}
        <button
          className={`navbar__burger ${menuOpen ? 'navbar__burger--open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Menu plein écran mobile */}
      <div className={`navbar__fullscreen ${menuOpen ? 'navbar__fullscreen--open' : ''}`}>
        <div className="navbar__fullscreen-inner">
          <ul className="navbar__fullscreen-links">
            {navLinks.map((link, i) => (
              <li key={link.label}>
                <a href={link.href} onClick={close}>
                  <span className="nav-num">0{i + 1}</span>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="navbar__fullscreen-footer">
            <a href="https://www.facebook.com/ayenouphoto/" target="_blank" rel="noreferrer">
              Facebook — ayenouphoto
            </a>
            <a href="mailto:yenouandre@gmail.com">yenouandre@gmail.com</a>
            <span>Contrexéville · Vosges</span>
          </div>
        </div>
      </div>
    </>
  )
}
