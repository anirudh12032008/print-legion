import { useEffect, useState } from 'react'

export default function Landing() {
    const [me, setMe] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        
        const checkAuth = async () => {
            try {
                // Check if token is in URL (from OAuth callback)
                const urlParams = new URLSearchParams(window.location.search)
                const tokenFromUrl = urlParams.get('token')
                if (tokenFromUrl) {
                    console.log('Landing page: token found in URL, storing in localStorage')
                    localStorage.setItem('pl_token', tokenFromUrl)
                    // Remove token from URL
                    window.history.replaceState({}, document.title, window.location.pathname)
                }
                
                const token = localStorage.getItem('pl_token')
                console.log('Landing page: checking token', token ? 'EXISTS' : 'NOT FOUND')
                if (!token) {
                    if (mounted) setLoading(false)
                    return
                }
                console.log('Landing page: fetching /api/me')
                const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
                console.log('Landing page: /api/me response status', res.status)
                if (!res.ok) {
                    console.warn('Landing page: /api/me failed, removing token')
                    localStorage.removeItem('pl_token')
                    if (mounted) setLoading(false)
                    return
                }
                const data = await res.json()
                console.log('Landing page: user data', data)
                if (mounted) setMe(data)
            } catch (err) {
                console.warn('Error fetching /api/me', err)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        
        checkAuth()
        
        // Also listen for storage events (in case token is set from another tab/window)
        const handleStorage = (e) => {
            if (e.key === 'pl_token') {
                console.log('Landing page: storage event detected, re-checking auth')
                checkAuth()
            }
        }
        window.addEventListener('storage', handleStorage)
        
        return () => { 
            mounted = false
            window.removeEventListener('storage', handleStorage)
        }
    }, [])

    function signOut() {
        localStorage.removeItem('pl_token')
        setMe(null)
    }

    return (
        <div className="container mx-auto px-4 py-8 w-full">
        <h1 className="text-3xl mb-6 font-bold text-center">PRINTING LEGION</h1>
        <p className="text-xl mb-4">
            Welcome to the printing legion! This is the international network of 3D printers from Hack Club!
        </p>
        <p className="text-xl mb-4 font-bold">
            Check out how it works here: <a href="https://docs.google.com/document/d/1ZfHi5eKbt0F2vbO0I1bMSIaMovqBu4Z6j_3GU6wREVc/edit?usp=sharing" target="_blank" className="text-blue-600 hover:underline">Google doc</a>
        </p>
        <p className="italic text-gray-600 mb-6">
            The previous instructions will be added to the site soon, but as a placeholder please click on the link above
        </p>

        <div className="my-6 justify-center flex flex-col items-center">
            <div className="mb-4">
                <a href="/printers" className="outline-1 py-2 px-6 rounded-xl text-lg font-bold bg-blue-500 text-white">Check out the printers</a>
            </div>
            <div className="mb-4">
                <a href="/request" className="outline-1 py-2 px-6 rounded-xl text-lg font-bold bg-green-600 text-white">Request a print</a>
            </div>

            {loading ? (
                <div className="mt-4 p-4 bg-gray-100 rounded-lg text-center">
                    <p className="text-gray-600">Loading...</p>
                </div>
            ) : me ? (
                <div className="mt-4 p-4 bg-green-50 border-2 border-green-400 rounded-lg text-center">
                    <div className="mb-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                            me.role === 'printer' 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-blue-600 text-white'
                        }`}>
                            {me.role === 'printer' ? '🖨️ Printer' : '👤 User'}
                        </span>
                    </div>
                    <p className="mb-3 text-lg">Welcome, <strong>{me.name || me.slack_id}</strong>!</p>
                    {me.role === 'printer' && (
                        <div className="mb-3">
                            <a href="/requests" className="inline-block py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                                Manage Requests
                            </a>
                        </div>
                    )}
                    <div>
                        <button onClick={signOut} className="text-sm text-red-600 hover:text-red-800 underline">
                            Sign out
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-4 p-4 bg-gray-50 border-2 border-gray-300 rounded-lg text-center">
                    <div className="mb-3">
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-gray-400 text-white">
                            🔓 Not logged in
                        </span>
                    </div>
                    <p className="mb-3 text-gray-700">Sign in to access personalized features</p>
                    <a href="/auth/slack/start" className="inline-block py-2 px-6 bg-gray-800 text-white rounded hover:bg-gray-900">
                        Sign in with Slack
                    </a>
                </div>
            )}
        </div>
        </div>
    );
}