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
          <p className="footer__tagline">Capturer l'instant, révéler l'émotion</p>
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
        <p>© {year} YENOU André Photographie — Contrexéville. Tous droits réservés.</p>
      </div>
    </footer>
  )
}
