import { useEffect, useState } from 'react'

function authFetch(url, opts = {}) {
  const token = localStorage.getItem('pl_token')
  const headers = opts.headers || {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(url, { ...opts, headers })
}

export default function Requests() {
  const [me, setMe] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch('/api/me')
        if (!r.ok) throw new Error('Not authenticated')
        const mejson = await r.json()
        setMe(mejson)
        if (mejson.role !== 'printer') {
          setError('You are not a printer')
          setLoading(false)
          return
        }
        const list = await authFetch('/api/requests')
        if (!list.ok) throw new Error('Failed to load requests')
        const json = await list.json()
        setRequests(json)
      } catch (err) {
        setError(err.message || String(err))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function handleAction(id, action) {
    try {
      const res = await authFetch(`/api/requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      if (!res.ok) throw new Error('Action failed')
      const updated = await res.json()
      setRequests((rs) => rs.map(r => (r.id === updated.id ? updated : r)))
    } catch (err) {
      setError(err.message || String(err))
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl mb-6">Requests (printer view)</h1>
      <p className="mb-4">Welcome, {me?.name || me?.slack_id} — you are signed in as a printer.</p>
      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="p-4 border rounded">
            <div className="flex justify-between">
              <div>
                <h3 className="font-semibold">{req.Name || req.name || 'Unnamed'}</h3>
                <p className="text-sm text-gray-600">{req.Description || req.description}</p>
                <p className="text-xs text-gray-500">Country: {req.Country || req.country}</p>
              </div>
              <div className="space-y-2 text-right">
                <div>Status: <strong>{req.Status || req.status || 'New'}</strong></div>
                <div className="flex space-x-2 mt-2">
                  <button onClick={() => handleAction(req.id, 'accept')} className="px-3 py-1 bg-green-600 text-white rounded">Accept</button>
                  <button onClick={() => handleAction(req.id, 'reject')} className="px-3 py-1 bg-red-600 text-white rounded">Reject</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
