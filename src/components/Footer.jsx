import './Footer.css'
import { getContact, useStorage } from '../utils/storage'

export default function Footer() {
  const year    = new Date().getFullYear()
  const contact = useStorage(getContact)

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <p className="footer__name">YENOU André <span>Photographie</span></p>
          <div className="footer__built">
            <span>Built with</span>
            <svg className="footer__tech-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="React">
              <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
              <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none" transform="rotate(60 12 12)"/>
              <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none" transform="rotate(120 12 12)"/>
            </svg>
            <span>React</span>
            <span className="footer__built-sep">+</span>
            <svg className="footer__tech-icon" viewBox="0 0 410 404" xmlns="http://www.w3.org/2000/svg" aria-label="Vite">
              <path d="M399.641 59.525l-183.998 330.08a8.65 8.65 0 01-15.152-.024L10.757 59.536a8.65 8.65 0 011.263-9.892l89.152-95.272a8.65 8.65 0 0112.874.593l93.069 105.3 92.7-105.3a8.65 8.65 0 0112.874-.593l89.152 95.272a8.65 8.65 0 011.8 9.881z" fill="currentColor" opacity=".6"/>
              <path d="M222.441 129.493l-51.839 88.893 139.542.588-139.46 245.796L344.496 129.493H222.441z" fill="currentColor"/>
            </svg>
            <span>Vite</span>
          </div>
        </div>

        <nav className="footer__nav">
          <a href="#accueil">Accueil</a>
          <a href="#portfolio">Portfolio</a>
          <a href="#apropos">À propos</a>
          <a href="#services">Services</a>
          <a href="#contact">Contact</a>
        </nav>

        <div className="footer__social">
          <a
            href={contact.facebook}
            target="_blank"
            rel="noreferrer"
            className="footer__social-link"
            aria-label="Facebook"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
          </a>
        </div>
      </div>

      <div className="footer__bottom">
        <p>© {year} YENOU André Photographie — Contrexéville. Tous droits réservés. &nbsp;·&nbsp; ❤️ by YENOU Sidney</p>
      </div>
    </footer>
  )
}
