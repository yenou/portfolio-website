import { useState, useRef } from 'react'
import emailjs from '@emailjs/browser'
import './Contact.css'
import { getContact, useStorage } from '../utils/storage'

const SERVICE_ID  = 'service_hlif5pf'
const TEMPLATE_ID = 'template_y3g8lmi'
const PUBLIC_KEY  = 'Q5lST5a2daKpu_uo3'

const RATE_LIMIT_MS = 60 * 1000 // 1 envoi par minute max

export default function Contact() {
  const contact = useStorage(getContact)
  const [form, setForm]       = useState({ name: '', email: '', subject: '', message: '' })
  const [honeypot, setHoneypot] = useState('')
  const [sent, setSent]       = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState('')
  const lastSent = useRef(0)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const sanitize = (str) => str.replace(/<[^>]*>/g, '').trim()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Honeypot : si rempli c'est un bot
    if (honeypot) return

    // Rate limiting
    const now = Date.now()
    if (now - lastSent.current < RATE_LIMIT_MS) {
      setError('Merci de patienter une minute avant de renvoyer un message.')
      return
    }

    // Validation longueur
    if (form.message.length < 10) { setError('Le message est trop court.'); return }
    if (form.message.length > 2000) { setError('Le message est trop long (2000 caractères max).'); return }

    setSending(true)
    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        name:    sanitize(form.name),
        email:   sanitize(form.email),
        subject: sanitize(form.subject) || 'Contact depuis le site',
        message: sanitize(form.message),
      }, PUBLIC_KEY)

      lastSent.current = Date.now()
      setSent(true)
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch {
      setError('Une erreur est survenue. Réessayez ou contactez-moi directement par email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="contact" className="contact">
      <div className="container contact__grid">
        <div className="contact__info">
          <p className="section-subtitle">Me contacter</p>
          <h2 className="section-title">Contact</h2>
          <div className="section-line"></div>

          <p className="contact__intro">
            Un projet en tête ? Une question ? N'hésitez pas à me contacter,
            je vous répondrai dans les plus brefs délais.
          </p>

          <div className="contact__details">
            <div className="contact__detail">
              <span className="contact__detail-icon">✉</span>
              <div>
                <span className="contact__detail-label">Email</span>
                <a href={`mailto:${contact.email}`} className="contact__detail-value">
                  {contact.email}
                </a>
              </div>
            </div>

            <div className="contact__detail">
              <span className="contact__detail-icon">✆</span>
              <div>
                <span className="contact__detail-label">Téléphone</span>
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="contact__detail-value">
                  {contact.phone}
                </a>
              </div>
            </div>

            <div className="contact__detail">
              <span className="contact__detail-icon">◎</span>
              <div>
                <span className="contact__detail-label">Localisation</span>
                <span className="contact__detail-value">{contact.location}</span>
              </div>
            </div>

            <div className="contact__detail">
              <span className="contact__detail-icon">f</span>
              <div>
                <span className="contact__detail-label">Facebook</span>
                <a
                  href={contact.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="contact__detail-value"
                >
                  {contact.facebookHandle}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="contact__form-wrap">
          {sent ? (
            <div className="contact__success">
              <span className="contact__success-icon">✓</span>
              <p>Message envoyé ! Je vous répondrai dès que possible.</p>
              <button className="btn btn--outline" onClick={() => setSent(false)}>
                Nouveau message
              </button>
            </div>
          ) : (
            <form className="contact__form" onSubmit={handleSubmit}>
              {/* Honeypot : champ invisible pour piéger les bots */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Nom</label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Votre nom"
                    maxLength={100}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="votre@email.com"
                    maxLength={150}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="subject">Sujet</label>
                <input
                  id="subject"
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="Séance portrait, reportage..."
                  maxLength={150}
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Décrivez votre projet..."
                  rows={6}
                  maxLength={2000}
                  required
                />
              </div>

              {error && <p className="contact__error">{error}</p>}

              <button type="submit" className="btn btn--solid" disabled={sending}>
                {sending ? 'Envoi en cours…' : 'Envoyer le message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
