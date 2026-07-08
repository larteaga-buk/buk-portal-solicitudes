import { useState } from 'react'

const COUNTRIES = ['Chile', 'Colombia', 'Perú', 'México', 'Brasil', 'LATAM', 'Corp']

const TEAMS = [
  'Product Marketing',
  'Customer Happiness',
  'Customer Education',
  'Marketing - Inbound',
  'Marketing - Content',
  'Marketing - Brand',
  'Marketing - Acquisition',
  'Personas',
  'Sales',
  'Sales - Outbound',
  'Sales - Partners',
  'Seguridad',
  'Data',
  'Digital',
  'Research',
  'Producto',
  'Operaciones',
  'SAC',
  'RevOps',
]

const isBukEmail = (domain) => domain?.toLowerCase().startsWith('buk.')

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('email') // 'email' | 'team'

  // Email mode
  const [email, setEmail] = useState('')

  // Team mode
  const [country, setCountry] = useState('')
  const [team, setTeam] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const domain = email.split('@')[1]?.toLowerCase()
  const validEmail = isBukEmail(domain)
  const validTeam = country && team

  const canSubmit = mode === 'email' ? validEmail : validTeam

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError('')

    try {
      const url = mode === 'email'
        ? `/api/tasks?email=${encodeURIComponent(email)}`
        : `/api/tasks?country=${encodeURIComponent(country)}&team=${encodeURIComponent(team)}`

      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al cargar tareas')

      onLogin({
        mode,
        email: mode === 'email' ? email : null,
        country: mode === 'team' ? country : null,
        team: mode === 'team' ? team : null,
        user: data.user,
        tasks: data.tasks,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={st.root}>
      <div style={st.card}>
        {/* Logo */}
        <div style={st.logoWrap}>
          <div style={st.logoIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="#2F4DAA"/>
              <path d="M8 8h8a6 6 0 010 12H8V8z" fill="white" opacity=".9"/>
              <path d="M8 14h10a4 4 0 010 8H8v-8z" fill="white"/>
            </svg>
          </div>
          <span style={st.logoText}>buk</span>
        </div>

        <h1 style={st.title}>Portal de solicitantes</h1>
        <p style={st.subtitle}>Consulta el estado de tus solicitudes de Marketing.</p>

        {/* Toggle de modo */}
        <div style={st.toggle}>
          <button
            type="button"
            onClick={() => { setMode('email'); setError('') }}
            style={{ ...st.toggleBtn, ...(mode === 'email' ? st.toggleActive : {}) }}
          >
            ✉️ Mi correo
          </button>
          <button
            type="button"
            onClick={() => { setMode('team'); setError('') }}
            style={{ ...st.toggleBtn, ...(mode === 'team' ? st.toggleActive : {}) }}
          >
            👥 Mi equipo
          </button>
        </div>

        <form onSubmit={handleSubmit} style={st.form}>

          {mode === 'email' ? (
            <>
              <label style={st.label}>Correo @buk</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="tu.nombre@buk.com"
                style={{
                  ...st.input,
                  borderColor: email && !validEmail ? '#e53e3e' : '#d1d5e0',
                }}
                autoFocus
                required
              />
              {email && !validEmail && (
                <p style={st.hint}>Solo se permiten correos @buk</p>
              )}
            </>
          ) : (
            <>
              <label style={st.label}>País</label>
              <select
                value={country}
                onChange={e => { setCountry(e.target.value); setError('') }}
                style={{ ...st.input, ...st.select }}
                required
              >
                <option value="">Selecciona tu país…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <label style={{ ...st.label, marginTop: '12px' }}>Área</label>
              <select
                value={team}
                onChange={e => { setTeam(e.target.value); setError('') }}
                style={{ ...st.input, ...st.select }}
                required
              >
                <option value="">Selecciona tu área…</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </>
          )}

          {error && <p style={st.errorMsg}>{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            style={{
              ...st.btn,
              opacity: !canSubmit || loading ? 0.55 : 1,
              cursor: !canSubmit || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <span style={st.spinnerRow}>
                <span style={st.spinner} /> Cargando…
              </span>
            ) : 'Ver mis solicitudes'}
          </button>
        </form>

        <p style={st.footer}>Marketing Corp · Buk</p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity:0; transform: translateY(16px); }
          to   { opacity:1; transform: translateY(0); }
        }
        select option { color: #2B3B6A; }
      `}</style>
    </div>
  )
}

const st = {
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
    padding: '44px 40px 36px',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 8px 40px rgba(47,77,170,.14)',
    animation: 'fadeUp .35s ease both',
  },
  logoWrap: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' },
  logoIcon: { lineHeight: 0 },
  logoText: { fontSize: '22px', fontWeight: 700, color: '#2F4DAA', letterSpacing: '-0.5px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#2B3B6A', marginBottom: '6px', lineHeight: 1.3 },
  subtitle: { fontSize: '14px', color: '#5f6880', marginBottom: '24px', lineHeight: 1.6 },

  toggle: {
    display: 'flex',
    background: '#EEF2FB',
    borderRadius: '10px',
    padding: '4px',
    marginBottom: '24px',
    gap: '4px',
  },
  toggleBtn: {
    flex: 1,
    padding: '9px 12px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#5f6880',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all .2s',
  },
  toggleActive: {
    background: '#fff',
    color: '#2F4DAA',
    boxShadow: '0 1px 6px rgba(47,77,170,.15)',
  },

  form: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: 600, color: '#2B3B6A', marginBottom: '4px' },
  input: {
    width: '100%',
    padding: '11px 14px',
    fontSize: '15px',
    border: '1.5px solid #d1d5e0',
    borderRadius: '10px',
    fontFamily: 'inherit',
    color: '#2B3B6A',
    background: '#fafafa',
    transition: 'border-color .2s',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: { cursor: 'pointer', appearance: 'auto' },
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
    marginTop: '18px',
    padding: '12px',
    background: '#2F4DAA',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'opacity .2s',
  },
  spinnerRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  spinner: {
    width: '16px', height: '16px',
    border: '2.5px solid rgba(255,255,255,.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin .7s linear infinite',
    display: 'inline-block',
  },
  footer: { marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#b0b8cc' },
}
