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
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [sortBy, setSortBy] = useState('date') // date, weight, country
  const [filterStatus, setFilterStatus] = useState('all') // all, pending, accepted, rejected

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
    setActionLoading(true)
    try {
      const res = await authFetch(`/api/requests/${id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ action }) 
      })
      if (!res.ok) throw new Error('Action failed')
      const updated = await res.json()
      setRequests((rs) => rs.map(r => (r.id === updated.id ? updated : r)))
      setSelectedRequest(null) // Close modal after action
    } catch (err) {
      alert('Error: ' + (err.message || String(err)))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  // Filter requests by status
  const filteredRequests = requests.filter(req => {
    const status = req.Status || req.status || 'Pending'
    if (filterStatus === 'all') return true
    if (filterStatus === 'pending') return !status || status === 'New' || status === 'Pending'
    if (filterStatus === 'accepted') return status === 'Accepted'
    if (filterStatus === 'rejected') return status === 'Rejected'
    return true
  })

  // Sort requests
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.ReceivedAt || a.received_at || 0)
      const dateB = new Date(b.ReceivedAt || b.received_at || 0)
      return dateB - dateA // newest first
    }
    if (sortBy === 'weight') {
      const weightA = a.WeightGrams || a.weight || 0
      const weightB = b.WeightGrams || b.weight || 0
      return weightB - weightA // heaviest first
    }
    if (sortBy === 'country') {
      const countryA = (a.Country || a.country || '').toLowerCase()
      const countryB = (b.Country || b.country || '').toLowerCase()
      return countryA.localeCompare(countryB)
    }
    return 0
  })

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Print Requests</h1>
        <p className="text-gray-600">Welcome, <strong>{me?.name || me?.slack_id}</strong> — Printer Dashboard</p>
      </div>

      {/* Filters and Sorting Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-gray-700">Filter:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All ({requests.length})</option>
            <option value="pending">Pending ({requests.filter(r => !r.Status || r.Status === 'New' || r.Status === 'Pending').length})</option>
            <option value="accepted">Accepted ({requests.filter(r => r.Status === 'Accepted').length})</option>
            <option value="rejected">Rejected ({requests.filter(r => r.Status === 'Rejected').length})</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-gray-700">Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Date (newest first)</option>
            <option value="weight">Weight (heaviest first)</option>
            <option value="country">Country (A-Z)</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-gray-600">
          Showing {sortedRequests.length} of {requests.length} requests
        </div>
      </div>

      {sortedRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">No requests match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedRequests.map(req => {
            const status = req.Status || req.status || 'Pending'
            const statusColor = status === 'Accepted' ? 'bg-green-100 text-green-800' : 
                               status === 'Rejected' ? 'bg-red-100 text-red-800' : 
                               'bg-yellow-100 text-yellow-800'
            const isAccepted = status === 'Accepted'
            const acceptedBy = req.AcceptedBy || req.accepted_by
            const completedAt = req.CompletedAt || req.completed_at
            const receivedAt = req.ReceivedAt || req.received_at
            
            return (
              <div 
                key={req.id} 
                onClick={() => setSelectedRequest(req)}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer bg-white"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg">{req.Name || req.name || 'Unnamed'}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${statusColor}`}>
                    {status}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-700">
                  {receivedAt && (
                    <div className="flex items-center text-xs text-gray-500">
                      <span className="font-semibold mr-2">Received:</span>
                      <span>{new Date(receivedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <span className="font-semibold mr-2">Country:</span>
                    <span>{req.Country || req.country || 'Not specified'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold mr-2">Weight:</span>
                    <span>{req.WeightGrams || req.weight ? `${req.WeightGrams || req.weight}g` : 'Not specified'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold mr-2">Material:</span>
                    <span className="truncate">{req.Material || req.material || 'Not specified'}</span>
                  </div>
                </div>
                
                {isAccepted && acceptedBy && (
                  <div className="mt-3 pt-3 border-t border-green-200 bg-green-50 -mx-4 -mb-4 px-4 py-2 rounded-b-lg">
                    <div className="text-xs text-green-800 space-y-1">
                      <div className="flex items-center">
                        <span className="font-semibold mr-2">Accepted by:</span>
                        <a 
                          href={`https://hackclub.slack.com/team/${acceptedBy}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline font-mono"
                        >
                          @{acceptedBy}
                        </a>
                      </div>
                      {completedAt && (
                        <div className="flex items-center">
                          <span className="font-semibold mr-2">Completed:</span>
                          <span>{new Date(completedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {!isAccepted && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 line-clamp-2">{req.Description || req.description}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Full Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedRequest(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{selectedRequest.Name || selectedRequest.name || 'Unnamed Request'}</h2>
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >×</button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Status</label>
                    <p className="text-lg">{selectedRequest.Status || selectedRequest.status || 'New'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Country</label>
                    <p className="text-lg">{selectedRequest.Country || selectedRequest.country || 'Not specified'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Weight</label>
                    <p className="text-lg">{selectedRequest.WeightGrams || selectedRequest.weight ? `${selectedRequest.WeightGrams || selectedRequest.weight}g` : 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Email</label>
                    <p className="text-lg">{selectedRequest.Email || selectedRequest.email || 'Not provided'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">Material</label>
                  <p className="text-lg whitespace-pre-wrap">{selectedRequest.Material || selectedRequest.material || 'Not specified'}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">Description</label>
                  <p className="text-lg whitespace-pre-wrap">{selectedRequest.Description || selectedRequest.description || 'No description'}</p>
                </div>

                {(selectedRequest.FileLink || selectedRequest.file_link) && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">File Link</label>
                    <a 
                      href={selectedRequest.FileLink || selectedRequest.file_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline block"
                    >
                      {selectedRequest.FileLink || selectedRequest.file_link}
                    </a>
                  </div>
                )}

                {(selectedRequest.DesiredDate || selectedRequest.desired_date) && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Desired Date</label>
                    <p className="text-lg">{selectedRequest.DesiredDate || selectedRequest.desired_date}</p>
                  </div>
                )}

                {(selectedRequest.Notes || selectedRequest.notes) && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Notes</label>
                    <p className="text-lg whitespace-pre-wrap">{selectedRequest.Notes || selectedRequest.notes}</p>
                  </div>
                )}

                {(selectedRequest.SlackID || selectedRequest.slack_id) && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Slack User</label>
                    <a 
                      href={`https://hackclub.slack.com/team/${selectedRequest.SlackID || selectedRequest.slack_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-mono text-sm block"
                    >
                      @{selectedRequest.SlackID || selectedRequest.slack_id}
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end space-x-3">
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  disabled={actionLoading}
                >
                  Close
                </button>
                <button 
                  onClick={() => handleAction(selectedRequest.id, 'reject')}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  disabled={actionLoading || (selectedRequest.Status || selectedRequest.status) === 'Rejected'}
                >
                  {actionLoading ? 'Processing...' : 'Reject'}
                </button>
                <button 
                  onClick={() => handleAction(selectedRequest.id, 'accept')}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  disabled={actionLoading || (selectedRequest.Status || selectedRequest.status) === 'Accepted'}
                >
                  {actionLoading ? 'Processing...' : 'Accept'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
