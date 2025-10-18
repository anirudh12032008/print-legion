import { useState, useEffect } from 'react'

export default function PrintRequestForm({ onSuccess }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    slack_id: '',
    description: '',
    file_link: '',
    material: '',
    desired_date: '',
    country: '',
    other_country: '',
    weight: '',
    notes: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [countries, setCountries] = useState([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/printers')
        const data = await res.json()
        if (!mounted) return
        // extract unique countries
        const countrySet = new Set()
        data.forEach((p) => {
          if (p.country) countrySet.add(p.country)
        })
        const list = Array.from(countrySet).sort()
        setCountries(list)
        // if there's at least one, preselect the first
        if (list.length && !form.country) {
          setForm((s) => ({ ...s, country: list[0] }))
        }
      } catch (err) {
        // ignore network errors; it's optional
        console.warn('Failed to load countries', err)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  function update(e) {
    const { name, value } = e.target
    setForm((s) => ({ ...s, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // prepare payload: decide country
      const countryToSend = form.country === 'Other' ? form.other_country : form.country

      const payload = {
        ...form,
        country: countryToSend,
      }

      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setForm({ name: '', email: '', slack_id: '', description: '', file_link: '', material: '', desired_date: '', country: '', other_country: '', weight: '', notes: '' })
      if (onSuccess) onSuccess(data)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Request a print</h2>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      <label className="block mb-2">
        <span className="text-sm">Your name</span>
        <input name="name" value={form.name} onChange={update} required className="w-full mt-1 p-2 border rounded" />
      </label>

      <label className="block mb-2">
        <span className="text-sm">Email (or Slack ID)</span>
        <input name="email" value={form.email} onChange={update} className="w-full mt-1 p-2 border rounded" />
      </label>

      <label className="block mb-2">
        <span className="text-sm">Slack ID</span>
        <input name="slack_id" value={form.slack_id} onChange={update} className="w-full mt-1 p-2 border rounded" />
      </label>

      <label className="block mb-2">
        <span className="text-sm">Description (what should be printed / notes)</span>
        <textarea name="description" value={form.description} onChange={update} required className="w-full mt-1 p-2 border rounded h-28" />
      </label>

      <label className="block mb-2">
        <span className="text-sm">File link (Google Drive / Dropbox)</span>
        <input name="file_link" value={form.file_link} onChange={update} className="w-full mt-1 p-2 border rounded" />
      </label>

      <label className="block mb-2">
        <span className="text-sm">Material (details, filament type, color, etc.)</span>
        <textarea name="material" value={form.material} onChange={update} className="w-full mt-1 p-2 border rounded h-20" />
      </label>

      <label className="block mb-2">
        <span className="text-sm">Country</span>
        <div className="mt-1">
          <select name="country" value={form.country} onChange={update} required className="w-full p-2 border rounded">
            <option value="">-- select your country --</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="Other">Other</option>
          </select>
        </div>
      </label>

      {form.country === 'Other' && (
        <label className="block mb-2">
          <span className="text-sm">Please enter your country</span>
          <input name="other_country" value={form.other_country} onChange={update} className="w-full mt-1 p-2 border rounded" />
        </label>
      )}

      <label className="block mb-2">
        <span className="text-sm">Rough weight (grams)</span>
        <input type="number" name="weight" value={form.weight} onChange={update} placeholder="e.g. 25" className="w-full mt-1 p-2 border rounded" />
      </label>

      <label className="block mb-2">
        <span className="text-sm">Desired date (optional)</span>
        <input type="date" name="desired_date" value={form.desired_date} onChange={update} className="w-full mt-1 p-2 border rounded" />
      </label>

      <label className="block mb-4">
        <span className="text-sm">Notes / Extra info (optional)</span>
        <textarea name="notes" value={form.notes} onChange={update} className="w-full mt-1 p-2 border rounded h-20" />
      </label>

      <div className="flex items-center space-x-3">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
          {loading ? 'Sending...' : 'Submit request'}
        </button>
        <button type="button" onClick={() => setForm({ name: '', email: '', slack_id: '', description: '', file_link: '', material: '', desired_date: '' })} className="px-4 py-2 rounded border">
          Reset
        </button>
      </div>
    </form>
  )
}
