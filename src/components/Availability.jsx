import { useEffect, useState } from 'react'
import { dbGetAvailability } from '../utils/db'
import './Availability.css'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

function CalendarMonth({ year, month, busy }) {
  const today = new Date()
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  // lundi = 0, ..., dimanche = 6
  const startOffset = (firstDay.getDay() + 6) % 7

  const days = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)

  return (
    <div className="avail__month">
      <p className="avail__month-name">{MONTHS_FR[month]} {year}</p>
      <div className="avail__grid-head">
        {DAYS_FR.map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="avail__grid">
        {days.map((d, i) => {
          if (!d) return <span key={`e-${i}`} className="avail__day avail__day--empty" />
          const key = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          const isPast = new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
          const isBusy = busy[key] === 'busy'
          return (
            <span
              key={key}
              className={`avail__day ${isPast ? 'avail__day--past' : isBusy ? 'avail__day--busy' : 'avail__day--free'}`}
            >
              {d}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default function Availability() {
  const [busy, setBusy] = useState({})

  useEffect(() => { dbGetAvailability().then(setBusy) }, [])

  const today = new Date()
  const months = [0, 1, 2].map(offset => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  return (
    <section id="disponibilites" className="avail">
      <div className="container">
        <div className="avail__header reveal">
          <p className="section-label">Planning</p>
          <h2 className="section-title">Disponibilités</h2>
        </div>
        <div className="avail__legend reveal" data-delay="1">
          <span className="avail__legend-item avail__legend--free">Disponible</span>
          <span className="avail__legend-item avail__legend--busy">Complet</span>
        </div>
        <div className="avail__months reveal" data-delay="2">
          {months.map(({ year, month }) => (
            <CalendarMonth key={`${year}-${month}`} year={year} month={month} busy={busy} />
          ))}
        </div>
        <p className="avail__cta reveal" data-delay="3">
          Une date vous convient ? <a href="#contact">Contactez-moi →</a>
        </p>
      </div>
    </section>
  )
}
