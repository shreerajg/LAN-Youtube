import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getHistory, clearVideoHistory, clearAllHistory } from '../api'

const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

function formatDuration(secs) {
    if (!secs) return '0:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
}

function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (days > 0) return `${days}d ago`
    if (hrs > 0) return `${hrs}h ago`
    if (mins > 0) return `${mins}m ago`
    return 'just now'
}

function progressPercent(video) {
    if (!video.duration || !video.watch_progress_secs) return 0
    return Math.min(100, (video.watch_progress_secs / video.duration) * 100)
}

export default function HistoryPage() {
    const navigate = useNavigate()
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [clearing, setClearing] = useState(null) // video id being cleared
    const [clearingAll, setClearingAll] = useState(false)
    const [confirmClearAll, setConfirmClearAll] = useState(false)

    const loadHistory = useCallback(() => {
        setLoading(true)
        getHistory()
            .then(setHistory)
            .catch(() => setHistory([]))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { loadHistory() }, [loadHistory])

    const handleClearOne = async (e, videoId) => {
        e.stopPropagation()
        setClearing(videoId)
        try {
            await clearVideoHistory(videoId)
            setHistory(h => h.filter(v => v.id !== videoId))
        } catch { /* silent */ }
        setClearing(null)
    }

    const handleClearAll = async () => {
        if (!confirmClearAll) { setConfirmClearAll(true); return }
        setClearingAll(true)
        try {
            await clearAllHistory()
            setHistory([])
        } catch { /* silent */ }
        setClearingAll(false)
        setConfirmClearAll(false)
    }

    // Group history by date
    const grouped = {}
    history.forEach(v => {
        const d = v.last_watched_at ? new Date(v.last_watched_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Unknown'
        if (!grouped[d]) grouped[d] = []
        grouped[d].push(v)
    })

    return (
        <div className="min-h-screen pb-20" style={{ background: 'var(--c-bg)' }}>
            {/* Background orbs */}
            <div className="orb w-[400px] h-[400px] bg-violet-700 top-0 -left-20" />
            <div className="orb w-80 h-80 bg-cyan-700 top-60 right-0" />

            <Navbar onSearch={() => {}} onLibraryRefresh={() => {}} />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative z-10">
                {/* Page header */}
                <div className="flex items-center justify-between mb-8 animate-fade-in">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <button
                                onClick={() => navigate('/')}
                                className="text-slate-500 hover:text-violet-400 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <h1 className="text-2xl font-black font-['Space_Grotesk'] text-white flex items-center gap-2">
                                <span className="text-violet-400">📋</span> Watch History
                            </h1>
                        </div>
                        <p className="text-sm text-slate-500 ml-8">
                            {history.length} {history.length === 1 ? 'video' : 'videos'} watched
                        </p>
                    </div>

                    {history.length > 0 && (
                        <button
                            id="clear-all-history-btn"
                            onClick={handleClearAll}
                            disabled={clearingAll}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                                ${confirmClearAll
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                                    : 'bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:bg-white/[0.08] hover:text-slate-200'
                                }`}
                        >
                            {clearingAll ? (
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            )}
                            {confirmClearAll ? 'Confirm clear all?' : 'Clear All'}
                        </button>
                    )}
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex flex-col gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-2xl bg-surface-800 border border-white/[0.03]">
                                <div className="skeleton w-32 h-18 rounded-lg shrink-0" style={{ aspectRatio: '16/9', width: '8rem' }} />
                                <div className="flex-1 space-y-2 py-1">
                                    <div className="skeleton h-4 w-3/4" />
                                    <div className="skeleton h-3 w-1/3" />
                                    <div className="skeleton h-2 w-full mt-3" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loading && history.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
                        <div className="text-7xl mb-4">📭</div>
                        <p className="text-slate-200 font-bold text-2xl mb-2">No watch history yet</p>
                        <p className="text-slate-500 text-sm mb-6 max-w-xs">
                            Videos you watch will appear here so you can pick up where you left off.
                        </p>
                        <button onClick={() => navigate('/')} className="btn-primary px-6 py-2.5 text-sm font-bold">
                            Browse Library
                        </button>
                    </div>
                )}

                {/* Grouped history list */}
                {!loading && history.length > 0 && (
                    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-8">
                        {Object.entries(grouped).map(([date, videos]) => (
                            <motion.div key={date} variants={itemVariants}>
                                {/* Date divider */}
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{date}</span>
                                    <div className="flex-1 h-px bg-gradient-to-r from-violet-500/20 to-transparent" />
                                </div>

                                <div className="flex flex-col gap-2">
                                    {videos.map(video => {
                                        const name = video.filename.replace(/\.[^/.]+$/, '')
                                        const pct = progressPercent(video)
                                        return (
                                            <div
                                                key={video.id}
                                                id={`history-item-${video.id}`}
                                                className="history-item group"
                                                onClick={() => navigate(`/player/${video.id}`)}
                                            >
                                                {/* Thumbnail */}
                                                <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: '9rem', aspectRatio: '16/9' }}>
                                                    <img
                                                        src={video.thumbnail_url}
                                                        alt={name}
                                                        loading="lazy"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                    {/* Progress bar */}
                                                    {pct > 0 && (
                                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                    {/* Play icon on hover */}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M8 5v14l11-7z" />
                                                        </svg>
                                                    </div>
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-violet-300 transition-colors">
                                                        {name}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                                                        <span className="bg-violet-500/10 text-violet-400 rounded px-1.5 py-0.5 border border-violet-500/15 font-medium text-[10px]">
                                                            {video.category}
                                                        </span>
                                                        <span>{formatDuration(video.duration)}</span>
                                                        {pct > 0 && (
                                                            <span className="text-violet-400">{Math.round(pct)}% watched</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 mt-1">
                                                        Watched {timeAgo(video.last_watched_at)}
                                                    </p>
                                                </div>

                                                {/* Clear button */}
                                                <button
                                                    id={`clear-history-${video.id}`}
                                                    onClick={(e) => handleClearOne(e, video.id)}
                                                    disabled={clearing === video.id}
                                                    className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-red-500/20 border border-white/[0.06] hover:border-red-500/30
                                                        text-slate-600 hover:text-red-400 flex items-center justify-center transition-all
                                                        opacity-0 group-hover:opacity-100"
                                                    title="Remove from history"
                                                >
                                                    {clearing === video.id ? (
                                                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </main>
        </div>
    )
}
