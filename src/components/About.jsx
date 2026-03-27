import { useState, useEffect, useRef } from 'react'
import './About.css'
import { getTexts, getAboutImg, useStorage } from '../utils/storage'

function AnimatedCounter({ target, suffix = '' }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        let startTime = null
        const duration = 2000
        const animate = (ts) => {
          if (!startTime) startTime = ts
          const progress = Math.min((ts - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.floor(eased * target))
          if (progress < 1) requestAnimationFrame(animate)
          else setCount(target)
        }
        requestAnimationFrame(animate)
        observer.unobserve(el)
      }
    }, { threshold: 0.5 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target])

  return <span ref={ref}>{count}{suffix}</span>
}

export default function About() {
  const texts    = useStorage(getTexts)
  const aboutImg = useStorage(getAboutImg) || '/images/about.jpg'

  return (
    <section id="apropos" className="about">
      {/* Background number */}
      <div className="about__bg-number">01</div>

      <div className="container">
        <div className="about__grid">

          {/* Image side */}
          <div className="about__left reveal">
            <div className="about__img-frame">
              <img
                src={aboutImg}
                alt="YENOU André photographe"
                className="about__img"
                onError={e => {
                  e.target.parentElement.classList.add('about__img-frame--empty')
                  e.target.style.display = 'none'
                }}
              />
              <div className="about__img-border" />
              <div className="about__img-caption">
                <p className="about__img-caption-label">Mon histoire</p>
                <h2 className="about__img-caption-title">À propos<br /><em>d'André</em></h2>
              </div>
            </div>

            <div className="about__stats">
              <div className="about__stat reveal" data-delay="1">
                <span className="about__stat-num">
                  <AnimatedCounter target={20} suffix="+" />
                </span>
                <span className="about__stat-label">Ans d'expérience</span>
              </div>
              <div className="about__stat reveal" data-delay="2">
                <span className="about__stat-num">
                  <AnimatedCounter target={3} />
                </span>
                <span className="about__stat-label">Spécialités</span>
              </div>
              <div className="about__stat reveal" data-delay="3">
                <span className="about__stat-num">∞</span>
                <span className="about__stat-label">Passion</span>
              </div>
            </div>
          </div>

          {/* Text side */}
          <div className="about__right">
            <div className="reveal">
              <p className="section-label">Mon histoire</p>
              <h2 className="section-title">À propos<br /><em>d'André</em></h2>
            </div>

            <blockquote className="about__quote reveal" data-delay="1">
              "{texts.aboutQuote}"
            </blockquote>

            <p className="about__text reveal" data-delay="2">
              {texts.aboutP1}
            </p>
            <p className="about__text reveal" data-delay="3">
              {texts.aboutP2}
            </p>
            <p className="about__text reveal" data-delay="4">
              {texts.aboutP3}
            </p>

            <a href="#contact" className="btn btn--ghost reveal" data-delay="4">
              Travailler ensemble
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
