import { useState } from 'react'

const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_DOMAINS || 'buk.com,buk.la')
  .split(',').map(d => d.trim().toLowerCase())

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const domain = email.split('@')[1]?.toLowerCase()
  const validDomain = domain && ALLOWED_DOMAINS.includes(domain)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validDomain) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/tasks?email=${encodeURIComponent(email)}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al cargar tareas')

      onLogin({ email, user: data.user, tasks: data.tasks })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        {/* Logo area */}
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="#2F4DAA"/>
              <path d="M8 8h8a6 6 0 010 12H8V8z" fill="white" opacity=".9"/>
              <path d="M8 14h10a4 4 0 010 8H8v-8z" fill="white"/>
            </svg>
          </div>
          <span style={styles.logoText}>buk</span>
        </div>

        <h1 style={styles.title}>Portal de solicitantes</h1>
        <p style={styles.subtitle}>
          Ingresa tu correo corporativo para ver el estado de tus solicitudes.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Correo @buk</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="tu.nombre@buk.com"
            style={{
              ...styles.input,
              borderColor: error ? '#e53e3e' : email && !validDomain ? '#e53e3e' : '#d1d5e0',
              outline: 'none',
            }}
            autoFocus
            required
          />
          {email && !validDomain && !loading && (
            <p style={styles.hint}>Solo se permiten correos @buk</p>
          )}
          {error && <p style={styles.errorMsg}>{error}</p>}

          <button
            type="submit"
            disabled={!validDomain || loading}
            style={{
              ...styles.btn,
              opacity: !validDomain || loading ? 0.55 : 1,
              cursor: !validDomain || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <span style={styles.spinnerRow}>
                <span style={styles.spinner} /> Cargando tareas…
              </span>
            ) : 'Ver mis tareas'}
          </button>
        </form>

        <p style={styles.footer}>
          Marketing Corp · Buk
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity:0; transform: translateY(16px); }
          to   { opacity:1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #EEF2FB 0%, #D9E3FC 100%)',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    padding: '48px 40px 36px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 8px 40px rgba(47,77,170,.14)',
    animation: 'fadeUp .35s ease both',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '28px',
  },
  logoIcon: { lineHeight: 0 },
  logoText: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#2F4DAA',
    letterSpacing: '-0.5px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#2B3B6A',
    marginBottom: '8px',
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '14px',
    color: '#5f6880',
    marginBottom: '32px',
    lineHeight: 1.6,
  },
  form: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '13px', fontWeight: 600, color: '#2B3B6A', marginBottom: '4px' },
  input: {
    width: '100%',
    padding: '11px 14px',
    fontSize: '15px',
    border: '1.5px solid #d1d5e0',
    borderRadius: '10px',
    fontFamily: 'inherit',
    color: '#2B3B6A',
    transition: 'border-color .2s',
    background: '#fafafa',
  },
  hint: { fontSize: '12px', color: '#e53e3e', marginTop: '2px' },
  errorMsg: {
    fontSize: '13px',
    color: '#e53e3e',
    background: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: '8px',
    padding: '10px 12px',
    marginTop: '4px',
  },
  btn: {
    marginTop: '16px',
    padding: '12px',
    background: '#2F4DAA',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'background .2s, opacity .2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinnerRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2.5px solid rgba(255,255,255,.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin .7s linear infinite',
    display: 'inline-block',
  },
  footer: {
    marginTop: '28px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#b0b8cc',
  },
}
