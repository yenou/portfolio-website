import { useState } from 'react'
import './Contact.css'
import { getContact, useStorage } from '../utils/storage'

export default function Contact() {
  const contact = useStorage(getContact)
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = (e) => {
    e.preventDefault()
    // Envoi par mailto (simple, sans serveur)
    const mailtoLink = `mailto:${contact.email}?subject=${encodeURIComponent(form.subject || 'Contact depuis le site')}&body=${encodeURIComponent(
      `Nom : ${form.name}\nEmail : ${form.email}\n\n${form.message}`
    )}`
    window.location.href = mailtoLink
    setSent(true)
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
              <p>Votre messagerie va s'ouvrir pour envoyer le message.</p>
              <button className="btn btn--outline" onClick={() => setSent(false)}>
                Nouveau message
              </button>
            </div>
          ) : (
            <form className="contact__form" onSubmit={handleSubmit}>
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
                  required
                />
              </div>

              <button type="submit" className="btn btn--solid">
                Envoyer le message
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
