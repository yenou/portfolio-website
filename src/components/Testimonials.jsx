import { useState } from 'react'
import './Testimonials.css'
import { getTestimonials, useStorage } from '../utils/storage'

export default function Testimonials() {
  const testimonials = useStorage(getTestimonials)
  const [current, setCurrent] = useState(0)

  const prev = () => setCurrent((current - 1 + testimonials.length) % testimonials.length)
  const next = () => setCurrent((current + 1) % testimonials.length)

  const t = testimonials[Math.min(current, testimonials.length - 1)]

  return (
    <section id="temoignages" className="testimonials">
      <div className="container">
        <p className="section-subtitle">Ce qu'ils disent</p>
        <h2 className="section-title">Témoignages</h2>
        <div className="section-line"></div>

        <div className="testimonials__carousel">
          <div className="testimonial" key={t.id}>
            <div className="testimonial__stars">
              {'★'.repeat(t.stars)}
            </div>
            <blockquote className="testimonial__text">
              &ldquo;{t.text}&rdquo;
            </blockquote>
            <div className="testimonial__author">
              <span className="testimonial__name">{t.name}</span>
              <span className="testimonial__context">— {t.context}</span>
            </div>
          </div>

          <div className="testimonials__nav">
            <button className="testimonials__nav-btn" onClick={prev}>‹</button>
            <div className="testimonials__dots">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  className={`testimonials__dot ${i === current ? 'active' : ''}`}
                  onClick={() => setCurrent(i)}
                />
              ))}
            </div>
            <button className="testimonials__nav-btn" onClick={next}>›</button>
          </div>
        </div>
      </div>
    </section>
  )
}
