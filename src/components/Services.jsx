import { useEffect, useRef } from 'react'
import './Services.css'
import { getServices, useStorage } from '../utils/storage'

const ICONS = [
  (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="24" cy="18" r="9"/>
      <path d="M6 42c0-9.94 8.06-18 18-18s18 8.06 18 18"/>
      <circle cx="24" cy="18" r="3" fill="currentColor" stroke="none"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 36 L24 8 L42 36 Z"/>
      <path d="M14 28 Q24 16 34 28"/>
      <circle cx="24" cy="30" r="2" fill="currentColor" stroke="none"/>
      <path d="M6 36 h36"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="6" y="14" width="36" height="26" rx="2"/>
      <path d="M16 14V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>
      <circle cx="24" cy="27" r="6"/>
      <circle cx="24" cy="27" r="2" fill="currentColor" stroke="none"/>
      <line x1="36" y1="20" x2="38" y2="20"/>
    </svg>
  ),
]

export default function Services() {
  const services = useStorage(getServices)
  const outroRef = useRef(null)

  useEffect(() => {
    const el = outroRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('services__outro--visible'); observer.disconnect() }
    }, { threshold: 0.25 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="services" className="services">
      <div className="container">
        <div className="services__header">
          <p className="section-subtitle">Ce que je propose</p>
          <h2 className="section-title">Services</h2>
          <div className="section-line"></div>
          <p className="services__intro">
            Que ce soit pour un instant intime ou un grand événement,<br/>
            chaque prestation est pensée avec soin et passion.
          </p>
        </div>

        <div className="services__grid">
          {services.map((service, i) => (
            <div key={service.id || service.title} className="service-card" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="service-card__icon-wrap">
                <div className="service-card__icon">{ICONS[i] || ICONS[0]}</div>
                <div className="service-card__icon-ring"></div>
              </div>
              <h3 className="service-card__title">{service.title}</h3>
              <div className="service-card__line"></div>
              <p className="service-card__desc">{service.description}</p>
              <ul className="service-card__details">
                {service.details.map(d => (
                  <li key={d}>
                    <span className="service-card__check">✓</span> {d}
                  </li>
                ))}
              </ul>
              <a href="#contact" className="service-card__cta">
                <span>Demander un devis</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          ))}
        </div>

        <div className="services__outro" ref={outroRef}>
          <div className="services__outro-icon">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Outer ring */}
              <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
              {/* Rotating aperture ring */}
              <g className="lens-rotate">
                <circle cx="40" cy="40" r="28" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" strokeDasharray="4 3"/>
              </g>
              {/* Aperture blades */}
              <g className="lens-spin">
                <path d="M40 18 L43 32 L40 40 L37 32 Z" fill="rgba(255,255,255,0.12)"/>
                <path d="M62 40 L48 43 L40 40 L48 37 Z" fill="rgba(255,255,255,0.12)"/>
                <path d="M40 62 L37 48 L40 40 L43 48 Z" fill="rgba(255,255,255,0.12)"/>
                <path d="M18 40 L32 37 L40 40 L32 43 Z" fill="rgba(255,255,255,0.12)"/>
                <path d="M55.6 24.4 L45.2 35.2 L40 40 L37 33 Z" fill="rgba(255,255,255,0.08)"/>
                <path d="M55.6 55.6 L44.8 45.2 L40 40 L47 37 Z" fill="rgba(255,255,255,0.08)"/>
                <path d="M24.4 55.6 L34.8 44.8 L40 40 L43 47 Z" fill="rgba(255,255,255,0.08)"/>
                <path d="M24.4 24.4 L35.2 34.8 L40 40 L33 43 Z" fill="rgba(255,255,255,0.08)"/>
              </g>
              {/* Inner lens */}
              <circle cx="40" cy="40" r="14" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
              <circle cx="40" cy="40" r="10" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
              {/* Center dot */}
              <circle cx="40" cy="40" r="3" fill="rgba(255,255,255,0.5)"/>
              {/* Light reflection */}
              <circle cx="34" cy="34" r="2" fill="rgba(255,255,255,0.2)"/>
            </svg>
          </div>
          <div className="services__outro-line" />
          <p className="services__outro-text">
            Après la prise de vue, chaque image est minutieusement traitée pour révéler toute sa richesse&nbsp;: couleurs équilibrées, contrastes travaillés et rendu fidèle à l'émotion du moment.
          </p>
          <p className="services__outro-text">
            Je vous propose ensuite, selon vos envies, la transmission de vos photos en format HD, idéales pour le web ou l'impression, ainsi que des tirages photo et impressions Fine Art sur des supports haut de gamme. De quoi sublimer vos images et les conserver durablement, sous la forme qui vous correspond le mieux.
          </p>
          <div className="services__outro-line" />
        </div>

      <div className="services__bokeh-transition">
        <span style={{ width: 180, height: 180, left: '10%',  animationDelay: '0s',    animationDuration: '7s'  }} />
        <span style={{ width: 80,  height: 80,  left: '30%',  animationDelay: '1.5s',  animationDuration: '9s'  }} />
        <span style={{ width: 260, height: 260, left: '55%',  animationDelay: '0.8s',  animationDuration: '11s' }} />
        <span style={{ width: 60,  height: 60,  left: '72%',  animationDelay: '2.5s',  animationDuration: '8s'  }} />
        <span style={{ width: 120, height: 120, left: '85%',  animationDelay: '0.3s',  animationDuration: '10s' }} />
        <div className="services__bokeh-fade" />
      </div>
      </div>
    </section>
  )
}
