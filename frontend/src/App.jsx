import { useCallback, useEffect, useMemo, useState } from 'react'

const blank = { title: '', service: '', severity: 'medium', owner: '', description: '' }
const next = {
  open: ['investigating'],
  investigating: ['mitigated', 'resolved'],
  mitigated: ['investigating', 'resolved'],
  resolved: ['investigating'],
}
const titleCase = (value) => value[0].toUpperCase() + value.slice(1)

async function api(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    throw new Error('Cannot reach the API. Check that the backend is running.')
  }
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data.detail
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map((item) => item.msg).join('; ') : `Request failed (${response.status})`)
  }
  return data
}

function dateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function Badge({ kind, value }) {
  return <span className={`badge ${kind}-${value}`}><i />{titleCase(value)}</span>
}

function IncidentForm({ incident, onCancel, onSave, saving, error }) {
  const [form, setForm] = useState(incident ? {
    title: incident.title, service: incident.service, severity: incident.severity,
    owner: incident.owner, description: incident.description,
  } : blank)
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  return <div className="overlay" onMouseDown={onCancel}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-heading"><div><span className="eyebrow">INCIDENT RECORD</span><h2 id="form-title">{incident ? 'Edit incident' : 'Declare an incident'}</h2><p>{incident ? 'Update the response details below.' : 'Capture the impact and assign an owner to begin response.'}</p></div><button className="icon-button" type="button" onClick={onCancel} aria-label="Close form">×</button></div>
      <form onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
        <label>Incident title<input name="title" value={form.title} onChange={change} minLength="3" maxLength="160" required placeholder="Checkout requests timing out" autoFocus /></label>
        <div className="form-grid">
          <label>Affected service<input name="service" value={form.service} onChange={change} minLength="2" maxLength="100" required placeholder="Checkout API" /></label>
          <label>Severity<select name="severity" value={form.severity} onChange={change}><option value="critical">Critical · P1</option><option value="high">High · P2</option><option value="medium">Medium · P3</option><option value="low">Low · P4</option></select></label>
        </div>
        <label>Response owner<input name="owner" value={form.owner} onChange={change} minLength="2" maxLength="100" required placeholder="On-call engineer" /></label>
        <label>Description and impact<textarea name="description" value={form.description} onChange={change} minLength="10" maxLength="5000" required rows="5" placeholder="What is failing, who is affected, and what has been observed?" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="button button-quiet" type="button" onClick={onCancel}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : incident ? 'Save changes' : 'Create incident'}</button></div>
      </form>
    </section>
  </div>
}

function IncidentDetail({ incident, onClose, onEdit, onDelete, onTransition, saving, error }) {
  return <div className="overlay drawer-overlay" onMouseDown={onClose}>
    <aside className="detail-drawer" aria-label={`Incident ${incident.id} details`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="drawer-top"><span className="eyebrow">INCIDENT #{String(incident.id).padStart(4, '0')}</span><button className="icon-button" type="button" onClick={onClose} aria-label="Close details">×</button></div>
      <h2>{incident.title}</h2>
      <div className="drawer-badges"><Badge kind="severity" value={incident.severity} /><Badge kind="status" value={incident.status} /></div>
      <section className="detail-section"><h3>Response</h3><dl className="detail-list">
        <div><dt>Service</dt><dd>{incident.service}</dd></div><div><dt>Owner</dt><dd>{incident.owner}</dd></div>
        <div><dt>Opened</dt><dd>{dateTime(incident.created_at)}</dd></div><div><dt>Last updated</dt><dd>{dateTime(incident.updated_at)}</dd></div>
        {incident.resolved_at && <div><dt>Resolved</dt><dd>{dateTime(incident.resolved_at)}</dd></div>}
      </dl></section>
      <section className="detail-section"><h3>Description & impact</h3><p className="description">{incident.description}</p></section>
      <section className="detail-section"><h3>Move the response forward</h3><p className="section-help">Status changes follow the incident response workflow.</p><div className="transition-actions">
        {next[incident.status].map((status) => <button key={status} className="button button-outline" type="button" onClick={() => onTransition(status)} disabled={saving}>{status === 'investigating' && incident.status === 'resolved' ? 'Reopen investigation' : `Mark ${status}`}</button>)}
      </div>{error && <p className="form-error" role="alert">{error}</p>}</section>
      <div className="drawer-footer"><button className="button button-quiet" type="button" onClick={onEdit}>Edit details</button><button className="text-danger" type="button" onClick={onDelete} disabled={saving}>Delete incident</button></div>
    </aside>
  </div>
}

function SummaryCard({ label, value, note, accent }) {
  return <div className={`summary-card card-${accent}`}><div className="summary-top"><span>{label}</span><span className="summary-spark">{accent === 'active' ? '↗' : '●'}</span></div><strong>{value}</strong><small>{note}</small></div>
}

export default function App() {
  const [incidents, setIncidents] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastLoadedAt, setLastLoadedAt] = useState(null)
  const [actionError, setActionError] = useState('')
  const [selected, setSelected] = useState(null)
  const [editor, setEditor] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')

  const refresh = useCallback(async () => {
    try {
      const [rows, counts] = await Promise.all([api('/api/incidents?limit=200'), api('/api/incidents/summary')])
      setIncidents(rows)
      setSummary(counts)
      setSelected((current) => current ? rows.find((row) => row.id === current.id) ?? null : null)
      setError('')
      setLastLoadedAt(new Date())
    } catch (caught) {
      setError(caught.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const visible = useMemo(() => incidents.filter((incident) => {
    const term = search.trim().toLowerCase()
    return (statusFilter === 'all' || incident.status === statusFilter)
      && (severityFilter === 'all' || incident.severity === severityFilter)
      && (!term || [incident.title, incident.service, incident.owner, incident.description].some((value) => value.toLowerCase().includes(term)))
  }), [incidents, search, statusFilter, severityFilter])

  async function save(form) {
    setSaving(true)
    setActionError('')
    try {
      const isEdit = editor?.mode === 'edit'
      const payload = isEdit ? { ...form, status: editor.incident.status } : form
      const saved = await api(isEdit ? `/api/incidents/${editor.incident.id}` : '/api/incidents', {
        method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(payload),
      })
      setEditor(null)
      await refresh()
      setSelected(saved)
    } catch (caught) {
      setActionError(caught.message)
    } finally {
      setSaving(false)
    }
  }

  async function transition(status) {
    if (!selected) return
    setSaving(true)
    setActionError('')
    try {
      const { title, service, severity, owner, description } = selected
      const updated = await api(`/api/incidents/${selected.id}`, { method: 'PUT', body: JSON.stringify({ title, service, severity, owner, description, status }) })
      await refresh()
      setSelected(updated)
    } catch (caught) {
      setActionError(caught.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!selected || !window.confirm(`Delete incident #${selected.id}? This cannot be undone.`)) return
    setSaving(true)
    setActionError('')
    try {
      await api(`/api/incidents/${selected.id}`, { method: 'DELETE' })
      setSelected(null)
      await refresh()
    } catch (caught) {
      setActionError(caught.message)
    } finally {
      setSaving(false)
    }
  }

  const byStatus = summary?.by_status ?? {}
  const active = (summary?.total ?? 0) - (byStatus.resolved ?? 0)
  const hasSnapshot = lastLoadedAt !== null

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><i /><i /><i /></span><span>signal<span>desk</span><small>INCIDENT COMMAND</small></span></div>
      <div className="sidebar-label">WORKSPACE</div><div className="nav-active"><span className="nav-icon">▦</span>Overview</div>
      <div className="sidebar-spacer" /><div className="sidebar-note"><span className="pulse-dot" /> RESPONSE WORKSPACE</div><p className="sidebar-caption">A clear place to track impact, ownership, and recovery.</p>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Incident overview</div><div className="topbar-right"><span className="live-indicator"><i /> Live response</span><span className="avatar">SD</span></div></header>
      <div className="content-wrap">
        <div className="page-intro"><div><span className="eyebrow">OPERATIONS / INCIDENTS</span><h1>Incident overview</h1><p>Keep every service disruption visible from detection to resolution.</p></div><button className="button button-primary create-button" type="button" onClick={() => { setActionError(''); setEditor({ mode: 'create' }) }}><span>＋</span> Declare incident</button></div>
        {error && <div className="api-error" role="alert"><strong>{hasSnapshot ? 'Stale incident data' : 'Data unavailable'}</strong><span>{error}{hasSnapshot && ` Last loaded ${dateTime(lastLoadedAt)}; counts and incidents may be outdated.`}</span><button type="button" onClick={refresh}>Retry</button></div>}
        {(!error || hasSnapshot) && <section className={`summary-grid ${error ? 'data-stale' : ''}`} aria-label={error ? 'Stale incident summary' : 'Incident summary'}>
          <SummaryCard label="Active incidents" value={active} note="Awaiting resolution" accent="active" />
          <SummaryCard label="Investigating" value={byStatus.investigating ?? 0} note="Response in progress" accent="investigating" />
          <SummaryCard label="Mitigated" value={byStatus.mitigated ?? 0} note="Impact contained" accent="mitigated" />
          <SummaryCard label="Resolved" value={byStatus.resolved ?? 0} note="Service restored" accent="resolved" />
        </section>}
        {(!error || hasSnapshot) && <section className={`incident-panel ${error ? 'data-stale' : ''}`}>
          <div className="panel-heading"><div><span className="eyebrow">RESPONSE QUEUE {error && <span className="stale-pill">STALE SNAPSHOT</span>}</span><h2>Incidents <span className="count-pill">{summary?.total ?? 0}</span></h2><p>Latest updates across your services</p></div><button className="refresh-button" type="button" onClick={refresh} aria-label="Refresh incidents">↻ <span>Refresh</span></button></div>
          <div className="filter-bar"><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search incidents" placeholder="Search incidents or services..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="mitigated">Mitigated</option><option value="resolved">Resolved</option></select><select aria-label="Filter by severity" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
          <div className="table-scroll"><table><thead><tr><th>INCIDENT</th><th>SERVICE</th><th>SEVERITY</th><th>STATUS</th><th>OWNER</th><th>LAST UPDATE</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{visible.map((incident) => <tr key={incident.id} onClick={() => { setActionError(''); setSelected(incident) }}><td><div className="incident-title">{incident.title}</div><span className="incident-id">#{String(incident.id).padStart(4, '0')}</span></td><td>{incident.service}</td><td><Badge kind="severity" value={incident.severity} /></td><td><Badge kind="status" value={incident.status} /></td><td>{incident.owner}</td><td className="time-cell">{dateTime(incident.updated_at)}</td><td><button className="row-open" type="button" aria-label={`View incident ${incident.id}`} onClick={(event) => { event.stopPropagation(); setActionError(''); setSelected(incident) }}>↗</button></td></tr>)}</tbody></table>
            {!loading && visible.length === 0 && <div className="empty-state"><span>◎</span><h3>{incidents.length ? 'No incidents match these filters' : 'Your response queue is clear'}</h3><p>{incidents.length ? 'Try another search, status, or severity.' : 'Declare an incident when a service needs attention.'}</p></div>}
            {loading && <div className="empty-state"><p>Loading incidents…</p></div>}</div>
          <div className="panel-footer">Showing {visible.length} of the latest {incidents.length} incident{incidents.length === 1 ? '' : 's'}{(summary?.total ?? 0) > incidents.length ? ` (${summary.total} total)` : ''}</div>
        </section>}
        <div className="workflow-note"><div className="workflow-icon">↗</div><div><strong>A simple response path</strong><p>Open → Investigating → Mitigated → Resolved. Reopen when an issue returns.</p></div></div>
      </div>
    </main>
    {selected && !editor && <IncidentDetail incident={selected} onClose={() => setSelected(null)} onEdit={() => { setActionError(''); setEditor({ mode: 'edit', incident: selected }) }} onDelete={remove} onTransition={transition} saving={saving} error={actionError} />}
    {editor && <IncidentForm key={editor.mode === 'edit' ? editor.incident.id : 'new'} incident={editor.incident} onCancel={() => { setEditor(null); setActionError('') }} onSave={save} saving={saving} error={actionError} />}
  </div>
}
