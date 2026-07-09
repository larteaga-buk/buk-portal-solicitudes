import { useState } from 'react'
import TaskTable from './TaskTable'

const AREAS = ['CRM', 'DISEÑO', 'AUDIOVISUAL', 'FRONT']

const AREA_META = {
  CRM:        { emoji: '🤝', color: '#E91E8C', bg: '#fde8f4' },
  'DISEÑO':   { emoji: '🎨', color: '#2F4DAA', bg: '#D9E3FC' },
  AUDIOVISUAL:{ emoji: '🎬', color: '#b8830e', bg: '#FEF8E6' },
  FRONT:      { emoji: '💻', color: '#27ae60', bg: '#e8f8f0' },
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Dashboard({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState('CRM')
  const { user, tasks } = session

  const currentTasks = tasks[activeTab] || []
  const totalCount = AREAS.reduce((s, a) => s + (tasks[a]?.length || 0), 0)

  return (
    <div style={s.root}>
      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.brand}>
            <div style={s.logoIcon}>
              <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="10" fill="#2F4DAA"/>
                <path d="M8 8h8a6 6 0 010 12H8V8z" fill="white" opacity=".9"/>
                <path d="M8 14h10a4 4 0 010 8H8v-8z" fill="white"/>
              </svg>
            </div>
            <div>
              <div style={s.brandName}>Portal de solicitantes</div>
              <div style={s.brandSub}>Marketing Corp · Buk</div>
            </div>
          </div>

          <div style={s.userBox}>
            <div style={s.avatar}>{user.name?.[0]?.toUpperCase() || '?'}</div>
            <div style={s.userInfo}>
              <div style={s.userName}>{user.name || user.email}</div>
              <div style={s.userEmail}>{user.email}</div>
            </div>
            <button onClick={onLogout} style={s.logoutBtn} title="Cerrar sesión">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Summary cards ── */}
      <div style={s.summaryRow}>
        {AREAS.map(area => {
          const meta = AREA_META[area]
          const count = tasks[area]?.length || 0
          const done = tasks[area]?.filter(t => /complet|done|cerrad|closed/i.test(t.status)).length || 0
          const totalPuntos = area === 'DISEÑO'
            ? (tasks[area] || []).reduce((sum, t) => sum + (t.puntos || 0), 0)
            : null
          return (
            <button
              key={area}
              onClick={() => setActiveTab(area)}
              style={{
                ...s.summaryCard,
                borderColor: activeTab === area ? meta.color : 'transparent',
                boxShadow: activeTab === area ? `0 0 0 2px ${meta.color}22, 0 4px 16px ${meta.color}18` : '0 2px 8px rgba(0,0,0,.06)',
              }}
            >
              <div style={{ ...s.summaryEmoji, background: meta.bg }}>{meta.emoji}</div>
              <div style={s.summaryName}>{area}</div>
              <div style={{ ...s.summaryCount, color: meta.color }}>{count}</div>
              <div style={s.summaryDone}>{done} completadas</div>
              {totalPuntos !== null && (
                <div style={{ ...s.summaryPuntos, color: meta.color }}>
                  ⚡ {totalPuntos} pts en total
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab bar ── */}
      <div style={s.tabBar}>
        {AREAS.map(area => {
          const meta = AREA_META[area]
          const count = tasks[area]?.length || 0
          const active = activeTab === area
          return (
            <button
              key={area}
              onClick={() => setActiveTab(area)}
              style={{
                ...s.tab,
                color: active ? meta.color : '#5f6880',
                borderBottom: active ? `3px solid ${meta.color}` : '3px solid transparent',
                fontWeight: active ? 700 : 500,
              }}
            >
              {AREA_META[area].emoji} {area}
              <span style={{
                ...s.tabBadge,
                background: active ? meta.bg : '#f0f0f5',
                color: active ? meta.color : '#9ba3b5',
              }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Table ── */}
      <div style={s.tableWrap}>
        {currentTasks.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>{AREA_META[activeTab]?.emoji}</div>
            <p style={s.emptyText}>No tienes tareas en el área de <strong>{activeTab}</strong></p>
          </div>
        ) : (
          <TaskTable tasks={currentTasks} areaColor={AREA_META[activeTab]?.color} showPuntos={activeTab === 'DISEÑO'} />
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform: translateY(12px); }
          to   { opacity:1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

const s = {
  root: { minHeight: '100vh', background: '#EEF2FB' },

  header: {
    background: '#fff',
    borderBottom: '1px solid #e4e6ef',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  brand: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoIcon: { lineHeight: 0 },
  brandName: { fontSize: '15px', fontWeight: 700, color: '#2B3B6A' },
  brandSub: { fontSize: '11px', color: '#9ba3b5', marginTop: '1px' },

  userBox: { display: 'flex', alignItems: 'center', gap: '10px' },
  avatar: {
    width: '34px', height: '34px', borderRadius: '50%',
    background: '#2F4DAA', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', fontWeight: 700, flexShrink: 0,
  },
  userInfo: { lineHeight: 1.3 },
  userName: { fontSize: '13px', fontWeight: 600, color: '#2B3B6A' },
  userEmail: { fontSize: '11px', color: '#9ba3b5' },
  logoutBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#9ba3b5', padding: '6px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', transition: 'color .2s',
  },

  summaryRow: {
    maxWidth: '1200px',
    margin: '24px auto 0',
    padding: '0 24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '14px',
  },
  summaryCard: {
    background: '#fff',
    border: '2px solid transparent',
    borderRadius: '14px',
    padding: '18px 16px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'border-color .2s, box-shadow .2s',
    animation: 'fadeUp .3s ease both',
  },
  summaryEmoji: {
    width: '38px', height: '38px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '18px', marginBottom: '12px',
  },
  summaryName: { fontSize: '11px', fontWeight: 600, color: '#9ba3b5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' },
  summaryCount: { fontSize: '28px', fontWeight: 700, lineHeight: 1, marginBottom: '4px' },
  summaryDone: { fontSize: '12px', color: '#9ba3b5' },
  summaryPuntos: { fontSize: '12px', fontWeight: 700, marginTop: '6px' },

  tabBar: {
    maxWidth: '1200px',
    margin: '20px auto 0',
    padding: '0 24px',
    display: 'flex',
    gap: '4px',
    borderBottom: '1px solid #e4e6ef',
  },
  tab: {
    background: 'none', border: 'none', borderBottom: '3px solid transparent',
    padding: '10px 16px', fontSize: '14px', cursor: 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px',
    transition: 'color .2s', whiteSpace: 'nowrap', marginBottom: '-1px',
  },
  tabBadge: {
    fontSize: '11px', fontWeight: 700, padding: '2px 7px',
    borderRadius: '99px', transition: 'background .2s, color .2s',
  },

  tableWrap: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px 24px 48px',
  },

  empty: {
    textAlign: 'center', padding: '64px 24px',
    background: '#fff', borderRadius: '14px',
    border: '1px solid #e4e6ef',
  },
  emptyIcon: { fontSize: '40px', marginBottom: '12px' },
  emptyText: { color: '#9ba3b5', fontSize: '15px' },
}
