import './Footer.css'
import { getContact, useStorage } from '../utils/storage'

export default function Footer() {
  const year    = new Date().getFullYear()
  const contact = useStorage(getContact)

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <div className="footer__brand-top">
            {contact.facebook && (
              <a
                href={contact.facebook}
                target="_blank"
                rel="noreferrer"
                className="footer__social-link"
                aria-label="Facebook"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
            )}
            <div>
              <p className="footer__name">YENOU <span>André</span></p>
              <p className="footer__tagline">Photographe · Contrexéville</p>
            </div>
          </div>
          <div className="footer__built">
            <span>Built by Sidney with</span>
            <svg className="footer__tech-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="React">
              <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
              <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none" transform="rotate(60 12 12)"/>
              <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none" transform="rotate(120 12 12)"/>
            </svg>
            <span>React,</span>
            <svg className="footer__tech-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Vite" fill="currentColor">
              <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/>
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
      </div>

    </footer>
  )
}
