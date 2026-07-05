import React, { useState, useEffect } from 'react'
import { getLanInfo, getLanDevices, getClipboard, addClipboard, deleteClipboardItem, clearClipboard } from '../api'
import { useToast } from '../components/Toast'

export default function LANDashboard() {
    const [info, setInfo] = useState(null)
    const [devices, setDevices] = useState([])
    const [scanning, setScanning] = useState(false)
    const [clipboard, setClipboard] = useState([])
    const [clipInput, setClipInput] = useState('')
    const { addToast } = useToast()

    const fetchInfo = async () => {
        try {
            const data = await getLanInfo()
            setInfo(data)
        } catch (err) {
            console.error(err)
        }
    }

    const fetchDevices = async () => {
        setScanning(true)
        try {
            const data = await getLanDevices()
            setDevices(data.devices || [])
        } catch (err) {
            console.error(err)
            addToast('Failed to scan LAN', 'error')
        } finally {
            setScanning(false)
        }
    }

    const fetchClipboard = async () => {
        try {
            const data = await getClipboard()
            setClipboard(data)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        fetchInfo()
        fetchDevices()
        fetchClipboard()
        
        // Polling info & clipboard occasionally
        const interval = setInterval(() => {
            fetchInfo()
            fetchClipboard()
        }, 10000)
        return () => clearInterval(interval)
    }, [])

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text)
        addToast('Copied to local clipboard', 'success')
    }

    const handleAddClip = async (e) => {
        e.preventDefault()
        if (!clipInput.trim()) return
        
        let deviceName = localStorage.getItem('lan_chat_name') || 'Anonymous'
        try {
            await addClipboard(clipInput, deviceName)
            setClipInput('')
            fetchClipboard()
            addToast('Added to LAN clipboard', 'success')
        } catch (err) {
            console.error(err)
            addToast('Failed to add clipboard', 'error')
        }
    }

    const handleDeleteClip = async (id) => {
        try {
            await deleteClipboardItem(id)
            fetchClipboard()
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <div className="pt-20 sm:pt-24 pb-6 sm:pb-8 px-4 sm:px-8 max-w-7xl mx-auto min-h-screen">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
                LAN Dashboard
            </h1>
            <p className="text-muted text-sm mb-8">Manage devices and synchronize clipboard across your network.</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column: Server Info & QR Code */}
                <div className="flex flex-col gap-6">
                    <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full -mr-10 -mt-10 group-hover:bg-cyan-500/20 transition-all"></div>
                        <h2 className="text-xl font-bold text-text mb-4">Connect Device</h2>
                        
                        <div className="flex justify-center mb-6 bg-white p-4 rounded-xl w-48 mx-auto">
                            {info ? (
                                <img src="/api/lan/qrcode" alt="QR Code" className="w-full h-auto" />
                            ) : (
                                <div className="w-full aspect-square bg-gray-200 animate-pulse rounded-lg"></div>
                            )}
                        </div>

                        <div className="text-center">
                            <p className="text-sm text-muted mb-1">Or open this URL on any LAN device:</p>
                            <a 
                                href={info?.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-lg font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                                {info?.url || 'Loading...'}
                            </a>
                        </div>
                    </div>

                    <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl">
                        <h2 className="text-xl font-bold text-text mb-4">Server Stats</h2>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-border border-dashed">
                                <span className="text-muted">Uptime</span>
                                <span className="font-mono text-text">{info?.uptime || '...'}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-border border-dashed">
                                <span className="text-muted">Online Users (Chat)</span>
                                <span className="font-mono text-neon3">{info?.online_users ?? '...'}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-border border-dashed">
                                <span className="text-muted">Total Videos</span>
                                <span className="font-mono text-text">{info?.total_videos ?? '...'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted">Shared Files</span>
                                <span className="font-mono text-text">{info?.shared_files ?? '...'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle Column: Device Discovery */}
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl flex flex-col max-h-[80vh]">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-text">LAN Devices</h2>
                        <button 
                            onClick={fetchDevices}
                            disabled={scanning}
                            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                                scanning 
                                ? 'bg-surface2 text-muted cursor-not-allowed' 
                                : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                            }`}
                        >
                            {scanning ? 'Scanning Subnet...' : 'Rescan Network'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                        {scanning && devices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted space-y-4 pt-10">
                                <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                                <p className="text-sm">Pinging 254 addresses on your subnet. This may take ~10 seconds...</p>
                            </div>
                        ) : devices.length === 0 ? (
                            <div className="text-center text-muted pt-10">No other devices found on this subnet.</div>
                        ) : (
                            devices.map((dev, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface2 border border-border hover:border-cyan-500/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">{dev.is_server ? '🖥️' : '📱'}</div>
                                        <div>
                                            <div className="font-medium text-sm text-text flex items-center gap-2">
                                                {dev.ip}
                                                {dev.is_server && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded text-xs uppercase tracking-wider font-bold">This Server</span>}
                                            </div>
                                            <div className="text-xs text-muted truncate max-w-[150px]" title={dev.hostname}>
                                                {dev.hostname !== dev.ip ? dev.hostname : 'Unknown Hostname'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-green-400 bg-green-400/10 px-2 py-1 rounded">
                                        {dev.ping_ms}ms
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Column: Clipboard Sync */}
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-xl flex flex-col max-h-[80vh]">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-text">Clipboard Sync</h2>
                        <button 
                            onClick={clearClipboard}
                            className="text-xs text-red-400 hover:text-red-300"
                        >
                            Clear All
                        </button>
                    </div>

                    <form onSubmit={handleAddClip} className="mb-4 flex gap-2">
                        <input
                            type="text"
                            value={clipInput}
                            onChange={e => setClipInput(e.target.value)}
                            placeholder="Paste text here to share..."
                            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-text"
                        />
                        <button 
                            type="submit"
                            disabled={!clipInput.trim()}
                            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 rounded-lg text-sm font-medium transition-colors"
                        >
                            Add
                        </button>
                    </form>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                        {clipboard.length === 0 ? (
                            <div className="text-center text-muted pt-10 text-sm">
                                Clipboard is empty.<br/>Paste something to share with other devices.
                            </div>
                        ) : (
                            clipboard.map(item => (
                                <div key={item.id} className="group relative p-3 rounded-xl bg-surface2 border border-border hover:border-violet-500/50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] text-muted font-medium bg-bg px-2 py-0.5 rounded-full">
                                            {item.device_name}
                                        </span>
                                        <span className="text-[10px] text-muted">
                                            {new Date(item.date_created).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <p className="text-sm text-text whitespace-pre-wrap break-words pr-8 mt-2 line-clamp-4">
                                        {item.content}
                                    </p>
                                    
                                    {/* Actions hover overlay */}
                                    <div className="absolute top-1/2 right-2 -translate-y-1/2 flex flex-col sm:flex-row gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-surface2/80 sm:bg-transparent p-1 sm:p-0 rounded-lg">
                                        <button 
                                            onClick={() => handleCopy(item.content)}
                                            className="p-2 sm:p-1.5 bg-surface rounded-md border border-border hover:bg-violet-500/20 hover:text-violet-400 text-muted transition-colors shadow-lg sm:shadow-none"
                                            title="Copy to local clipboard"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteClip(item.id)}
                                            className="p-2 sm:p-1.5 bg-surface rounded-md border border-border hover:bg-red-500/20 hover:text-red-400 text-muted transition-colors shadow-lg sm:shadow-none"
                                            title="Delete"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
