import { useState } from 'react'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status, color }) {
  // Map common ClickUp status names to display labels
  const label = status || 'Sin estado'

  // Determine semantic color
  let bg = '#f0f0f5'
  let fg = '#5f6880'

  if (color && color !== '#000000' && color !== '#ffffff') {
    fg = color
    // Lighten the color for background
    bg = color + '22'
  } else {
    const lc = status?.toLowerCase() || ''
    if (/complet|done|cerrad|entregad/.test(lc)) { bg = '#e8f8f0'; fg = '#1d8a5e' }
    else if (/progress|curso|review|revisión/.test(lc)) { bg = '#e8f4fd'; fg = '#1a7fc1' }
    else if (/pending|espera|pendiente/.test(lc)) { bg = '#fff8e8'; fg = '#b07d10' }
    else if (/bloqueado|blocked|cancel/.test(lc)) { bg = '#fff0ea'; fg = '#d6552a' }
  }

  return (
    <span style={{ ...sb.badge, background: bg, color: fg }}>
      <span style={{ ...sb.dot, background: fg }} />
      {label}
    </span>
  )
}

const sb = {
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '3px 10px', borderRadius: '99px',
    fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
  },
  dot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
}

export default function TaskTable({ tasks, areaColor, showPuntos = false }) {
  const [expanded, setExpanded] = useState(null)
  const [sortKey, setSortKey] = useState('dateDue')
  const [sortDir, setSortDir] = useState('asc')

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...tasks].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  function SortIcon({ col }) {
    if (sortKey !== col) return <span style={{ color: '#c8c0e8', marginLeft: '4px' }}>⇅</span>
    return <span style={{ color: areaColor, marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div style={t.wrap}>
      <table style={t.table}>
        <thead>
          <tr style={t.headRow}>
            {[
              { key: 'name',        label: 'Tarea' },
              { key: 'dateCreated', label: 'Fecha solicitada' },
              { key: 'dateDue',     label: 'Fecha de entrega' },
              { key: 'status',      label: 'Estado en ClickUp' },
              { key: 'sprint',      label: 'Sprint' },
              ...(showPuntos ? [{ key: 'puntos', label: 'Puntos' }] : []),
              { key: null,          label: 'Entregable' },
            ].map(col => (
              <th
                key={col.label}
                style={{
                  ...t.th,
                  cursor: col.key ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
                onClick={() => col.key && toggleSort(col.key)}
              >
                {col.label}
                {col.key && <SortIcon col={col.key} />}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((task, i) => {
            const isOpen = expanded === task.id
            const isOverdue = task.dateDue && task.dateDue < Date.now() &&
              !/complet|done|cerrad/i.test(task.status)

            return (
              <>
                <tr
                  key={task.id}
                  style={{
                    ...t.row,
                    background: isOpen ? '#faf8ff' : (i % 2 === 0 ? '#fff' : '#fafafa'),
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpanded(isOpen ? null : task.id)}
                >
                  {/* Tarea */}
                  <td style={{ ...t.td, ...t.tdName }}>
                    <div style={t.taskNameRow}>
                      <span style={t.chevron}>{isOpen ? '▾' : '▸'}</span>
                      <span style={t.taskName}>{task.name}</span>
                    </div>
                    {task.list && <span style={t.listTag}>{task.list}</span>}
                  </td>

                  {/* Fecha solicitada */}
                  <td style={t.td}>
                    <span style={t.dateVal}>{fmtDate(task.dateCreated)}</span>
                  </td>

                  {/* Fecha de entrega */}
                  <td style={t.td}>
                    <span style={{
                      ...t.dateVal,
                      color: isOverdue ? '#d6552a' : 'inherit',
                      fontWeight: isOverdue ? 600 : 400,
                    }}>
                      {fmtDate(task.dateDue)}
                      {isOverdue && <span style={t.overduePill}>Vencida</span>}
                    </span>
                  </td>

                  {/* Estado */}
                  <td style={t.td}>
                    <StatusBadge status={task.status} color={task.statusColor} />
                  </td>

                  {/* Sprint */}
                  <td style={{ ...t.td, textAlign: 'center' }}>
                    {task.sprint === 'Sí'
                      ? <span style={t.sprintYes}>✓ En sprint</span>
                      : task.sprint === 'No'
                        ? <span style={t.sprintNo}>Fuera de sprint ⚠️</span>
                        : <span style={t.noLink}>—</span>}
                  </td>

                  {/* Puntos (solo Diseño) */}
                  {showPuntos && (
                    <td style={{ ...t.td, textAlign: 'center' }}>
                      {task.puntos != null
                        ? <span style={{ ...t.puntosBadge, borderColor: areaColor, color: areaColor }}>⚡ {task.puntos}</span>
                        : <span style={t.noLink}>—</span>}
                    </td>
                  )}

                  {/* Entregable */}
                  <td style={t.td}>
                    {task.entregableLink ? (
                      <a
                        href={task.entregableLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...t.link, color: areaColor }}
                        onClick={e => e.stopPropagation()}
                      >
                        Ver entregable ↗
                      </a>
                    ) : (
                      <span style={t.noLink}>—</span>
                    )}
                  </td>
                </tr>

                {/* Expanded row: description */}
                {isOpen && (
                  <tr key={task.id + '-desc'} style={{ background: '#faf8ff' }}>
                    <td colSpan={6 + (showPuntos ? 1 : 0)} style={t.descCell}>
                      <div style={t.descBox}>
                        <div style={t.descTitle}>Descripción</div>
                        {task.description
                          ? <p style={t.descText}>{task.description}</p>
                          : <p style={{ ...t.descText, color: '#9ba3b5', fontStyle: 'italic' }}>Sin descripción.</p>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const t = {
  wrap: {
    background: '#fff',
    borderRadius: '14px',
    border: '1px solid #e4e6ef',
    overflow: 'hidden',
    animation: 'fadeUp .3s ease both',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  headRow: { background: '#f8f7fd' },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#5f6880',
    textAlign: 'left',
    borderBottom: '1px solid #e4e6ef',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  row: { borderBottom: '1px solid #f0f0f5', transition: 'background .15s' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#1a1a2e', verticalAlign: 'middle' },
  tdName: { maxWidth: '320px' },
  taskNameRow: { display: 'flex', alignItems: 'flex-start', gap: '6px' },
  chevron: { color: '#c8c0e8', fontSize: '11px', marginTop: '2px', flexShrink: 0 },
  taskName: { lineHeight: 1.45, fontWeight: 500 },
  listTag: {
    display: 'inline-block', marginTop: '4px', marginLeft: '17px',
    fontSize: '11px', color: '#9ba3b5', background: '#f0f0f5',
    padding: '1px 7px', borderRadius: '99px',
  },
  dateVal: { fontSize: '13px', color: '#5f6880', whiteSpace: 'nowrap' },
  overduePill: {
    display: 'inline-block', marginLeft: '6px',
    fontSize: '10px', fontWeight: 700, color: '#d6552a',
    background: '#fff0ea', padding: '1px 6px', borderRadius: '99px',
  },
  link: { fontSize: '13px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' },
  noLink: { color: '#c8c0e8' },
  puntosBadge: {
    display: 'inline-block', padding: '2px 10px',
    border: '1.5px solid', borderRadius: '99px',
    fontSize: '12px', fontWeight: 700,
  },
  sprintYes: {
    display: 'inline-block', padding: '2px 10px',
    background: '#e8f8f0', color: '#1d8a5e',
    borderRadius: '99px', fontSize: '12px', fontWeight: 700,
  },
  sprintNo: {
    display: 'inline-block', padding: '2px 10px',
    background: '#fff8e8', color: '#b07d10',
    borderRadius: '99px', fontSize: '12px', fontWeight: 600,
  },
  descCell: { padding: '0 16px 16px 16px' },
  descBox: {
    background: '#f8f7fd', borderRadius: '10px', padding: '16px 18px',
  },
  descTitle: { fontSize: '11px', fontWeight: 700, color: '#9ba3b5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' },
  descText: { fontSize: '14px', color: '#3d3a5a', lineHeight: 1.65 },
}
