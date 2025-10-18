import { useState } from 'react'
import PrintRequestForm from '../components/PrintRequestForm'

export default function RequestPrint() {
  const [success, setSuccess] = useState(null)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <a href="/" className="text-blue-600 hover:underline">&larr; Back</a>
      </div>
      {success ? (
        <div className="max-w-2xl mx-auto bg-green-50 p-6 rounded">
          <h2 className="text-lg font-semibold">Request received</h2>
          <p className="mt-2">Thanks — your request ID is <span className="font-mono">{success.id}</span>. Someone will be in touch.</p>
        </div>
      ) : (
        <PrintRequestForm onSuccess={(data) => setSuccess(data)} />
      )}
    </div>
  )
}
