import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getLanInfo, getLanDevices, getClipboard, addClipboard, deleteClipboardItem, clearClipboard } from '../api'

const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}
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
        <div className="pt-24 pb-8 px-4 sm:px-8 max-w-7xl mx-auto min-h-screen">
            <h1 className="text-4xl font-black font-['Space_Grotesk'] text-white tracking-tight mb-2">
                LAN Dashboard
            </h1>
            <p className="text-slate-400 text-sm mb-8 font-medium">Manage devices and synchronize clipboard across your network.</p>

            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min">
                
                {/* Bento Item: Connect Device (Takes 1 column) */}
                <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 relative overflow-hidden group col-span-1 md:col-span-1 lg:col-span-1 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/20 blur-[60px] rounded-full -mr-10 -mt-10 group-hover:bg-cyan-500/30 transition-all duration-700"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-violet-500/10 blur-[50px] rounded-full transition-all duration-700 group-hover:bg-violet-500/20"></div>
                    
                    <h2 className="text-lg font-bold text-white mb-6 relative z-10 font-['Space_Grotesk'] flex items-center gap-2">
                        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Connect Device
                    </h2>
                    
                    <div className="relative z-10 flex justify-center mb-6 bg-white p-3 rounded-2xl w-48 shadow-[0_0_30px_rgba(6,182,212,0.15)] group-hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-shadow duration-300">
                        {info ? (
                            <img src="/api/lan/qrcode" alt="QR Code" className="w-full h-auto rounded-lg" />
                        ) : (
                            <div className="w-full aspect-square bg-gray-100 animate-pulse rounded-lg"></div>
                        )}
                    </div>

                    <div className="text-center relative z-10">
                        <p className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">Or open this URL:</p>
                        <a 
                            href={info?.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-block px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-sm font-mono text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
                        >
                            {info?.url || 'Loading...'}
                        </a>
                    </div>
                </div>

                {/* Bento Item: Server Stats (Takes 1 column) */}
                <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 relative overflow-hidden group col-span-1 md:col-span-1 lg:col-span-1 flex flex-col justify-between">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-violet-600/5 blur-[80px] rounded-full group-hover:bg-violet-600/10 transition-colors duration-700"></div>
                    
                    <h2 className="text-lg font-bold text-white mb-6 relative z-10 font-['Space_Grotesk'] flex items-center gap-2">
                        <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                        Server Stats
                    </h2>
                    
                    <div className="space-y-3 relative z-10 flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:border-violet-500/20 transition-colors">
                            <span className="text-slate-400 text-sm font-medium">Uptime</span>
                            <span className="font-mono text-white text-sm bg-violet-500/10 px-2 py-0.5 rounded-md text-violet-300">{info?.uptime || '...'}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:border-pink-500/20 transition-colors">
                            <span className="text-slate-400 text-sm font-medium">Online Users (Chat)</span>
                            <span className="font-mono text-white text-sm bg-pink-500/10 px-2 py-0.5 rounded-md text-pink-400">{info?.online_users ?? '...'}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/20 transition-colors">
                            <span className="text-slate-400 text-sm font-medium">Total Videos</span>
                            <span className="font-mono text-white text-sm bg-emerald-500/10 px-2 py-0.5 rounded-md text-emerald-400">{info?.total_videos ?? '...'}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/20 transition-colors">
                            <span className="text-slate-400 text-sm font-medium">Shared Files</span>
                            <span className="font-mono text-white text-sm bg-blue-500/10 px-2 py-0.5 rounded-md text-blue-400">{info?.shared_files ?? '...'}</span>
                        </div>
                    </div>
                </div>

                {/* Bento Item: LAN Devices (Takes 1 or 2 columns based on screen) */}
                <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 shadow-xl flex flex-col md:col-span-2 lg:col-span-1 max-h-[450px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            Network Devices
                        </h2>
                        <button 
                            onClick={fetchDevices}
                            disabled={scanning}
                            className={`text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all duration-300 ${
                                scanning 
                                ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40'
                            }`}
                        >
                            {scanning ? 'Scanning...' : 'Rescan'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {scanning && devices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                <p className="text-sm text-center">Pinging 254 addresses...<br/><span className="text-xs text-slate-500">Takes about 10 seconds</span></p>
                            </div>
                        ) : devices.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-500 text-sm">No other devices found.</div>
                        ) : (
                            devices.map((dev, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${dev.is_server ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                            {dev.is_server ? (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm text-white flex items-center gap-2">
                                                {dev.ip}
                                                {dev.is_server && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Host</span>}
                                            </div>
                                            <div className="text-xs text-slate-400 truncate max-w-[140px]" title={dev.hostname}>
                                                {dev.hostname !== dev.ip ? dev.hostname : 'Unknown Hostname'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-md">
                                        {dev.ping_ms}ms
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Bento Item: Clipboard Sync (Takes full width on tablet, 2 on lg if we want, or spans remaining space) */}
                <motion.div variants={itemVariants} className="glass-card rounded-3xl p-6 flex flex-col md:col-span-2 lg:col-span-3 min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
                            <svg className="w-5 h-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Universal Clipboard
                        </h2>
                        <button 
                            onClick={clearClipboard}
                            className="text-xs font-bold uppercase tracking-wider text-red-400/80 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-transparent hover:border-red-400/20 hover:bg-red-400/10"
                        >
                            Clear All
                        </button>
                    </div>

                    <form onSubmit={handleAddClip} className="mb-6 flex gap-3">
                        <input
                            type="text"
                            value={clipInput}
                            onChange={e => setClipInput(e.target.value)}
                            placeholder="Paste any text, URL, or code here to share across devices..."
                            className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/50 text-white transition-all shadow-inner"
                        />
                        <button 
                            type="submit"
                            disabled={!clipInput.trim()}
                            className="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 disabled:hover:bg-fuchsia-600 text-white px-6 rounded-xl text-sm font-semibold transition-colors shadow-[0_4px_15px_rgba(192,38,211,0.3)] hover:shadow-[0_6px_20px_rgba(192,38,211,0.5)]"
                        >
                            Share
                        </button>
                    </form>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4">
                        {clipboard.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-10 text-slate-500">
                                <svg className="w-12 h-12 mb-3 text-white/5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                <p className="text-sm">Clipboard is empty.</p>
                            </div>
                        ) : (
                            clipboard.map(item => (
                                <div key={item.id} className="group relative p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-fuchsia-500/30 hover:bg-white/[0.04] transition-all flex flex-col h-[140px]">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] text-fuchsia-300 font-bold uppercase tracking-wider bg-fuchsia-500/10 px-2 py-0.5 rounded-full border border-fuchsia-500/20">
                                            {item.device_name}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {new Date(item.date_created).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap break-words mt-1 line-clamp-3 font-mono">
                                        {item.content}
                                    </p>
                                    
                                    {/* Actions hover overlay */}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0d0d1f]/80 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-xl">
                                        <button 
                                            onClick={() => handleCopy(item.content)}
                                            className="p-1.5 rounded-md hover:bg-fuchsia-500/20 hover:text-fuchsia-300 text-slate-400 transition-colors"
                                            title="Copy"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteClip(item.id)}
                                            className="p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-colors"
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
                </motion.div>

            </motion.div>
        </div>
    )
}
