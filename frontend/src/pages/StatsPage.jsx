import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getWatchStats, getStats } from '../api'

function formatDuration(secs) {
    if (!secs || secs === 0) return '0:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
}

// ── Animated counter ────────────────────────────────────────────────────────
function AnimCounter({ value, suffix = '', decimals = 0 }) {
    const [display, setDisplay] = useState(0)
    useEffect(() => {
        if (!value && value !== 0) return
        const target = parseFloat(value)
        const steps = 40
        const step = target / steps
        let current = 0
        const timer = setInterval(() => {
            current = Math.min(current + step, target)
            setDisplay(decimals > 0 ? current.toFixed(decimals) : Math.round(current))
            if (current >= target) clearInterval(timer)
        }, 20)
        return () => clearInterval(timer)
    }, [value, decimals])
    return <>{display}{suffix}</>
}

// ── Big stat card ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card rounded-2xl p-6 flex items-center gap-5 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 cursor-default group"
        >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 border border-white/5 group-hover:scale-110 transition-transform duration-300 ${color}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className={`text-3xl font-black font-['Space_Grotesk'] ${color.replace('bg-', 'text-').replace('/15', '-400')}`}>
                    {value}
                </p>
                <p className="text-sm font-bold text-slate-300 mt-0.5">{label}</p>
                {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
            </div>
        </motion.div>
    )
}

// ── Category bar chart ──────────────────────────────────────────────────────
function CategoryChart({ data }) {
    if (!data || data.length === 0) return null
    const max = Math.max(...data.map(d => d.total_secs), 1)
    const COLORS = [
        'from-violet-500 to-violet-600',
        'from-cyan-500 to-cyan-600',
        'from-amber-500 to-amber-600',
        'from-emerald-500 to-emerald-600',
        'from-pink-500 to-pink-600',
        'from-blue-500 to-blue-600',
        'from-orange-500 to-orange-600',
        'from-teal-500 to-teal-600',
    ]

    return (
        <div className="space-y-3">
            {data.slice(0, 8).map((item, i) => (
                <motion.div
                    key={item.category}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.4 }}
                    className="flex items-center gap-3"
                >
                    <span className="text-xs text-slate-400 font-medium w-28 shrink-0 truncate">{item.category}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.total_secs / max) * 100}%` }}
                            transition={{ delay: 0.1 + 0.05 * i, duration: 0.7, ease: 'easeOut' }}
                            className={`h-full rounded-full bg-gradient-to-r ${COLORS[i % COLORS.length]}`}
                        />
                    </div>
                    <span className="text-xs text-slate-500 font-mono w-16 text-right shrink-0">
                        {formatDuration(item.total_secs)}
                    </span>
                </motion.div>
            ))}
        </div>
    )
}

// ── Top video row ───────────────────────────────────────────────────────────
function TopVideoRow({ video, rank }) {
    const rankColors = ['text-amber-400', 'text-slate-300', 'text-amber-600']
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.05, duration: 0.35 }}
            className="flex items-center gap-3 group hover:bg-white/[0.03] rounded-xl px-2 py-2 transition-colors"
        >
            <span className={`text-sm font-black w-5 text-center shrink-0 ${rankColors[rank] || 'text-slate-600'}`}>
                {rank + 1}
            </span>
            <img
                src={video.thumbnail_url}
                alt=""
                className="w-14 h-8 object-cover rounded-lg shrink-0 border border-white/10"
            />
            <div className="flex-1 min-w-0">
                <Link
                    to={`/player/${video.id}`}
                    className="text-sm font-semibold text-slate-200 group-hover:text-violet-400 transition-colors line-clamp-1"
                >
                    {video.filename.replace(/\.[^/.]+$/, '')}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                            style={{ width: `${video.percent}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-slate-600 font-mono shrink-0">
                        {video.percent}%
                    </span>
                </div>
            </div>
            <div className="text-right shrink-0">
                <p className="text-xs text-violet-400 font-mono font-bold">{formatDuration(video.watch_progress_secs)}</p>
                <p className="text-[10px] text-slate-600">{video.category}</p>
            </div>
        </motion.div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StatsPage() {
    const [watchStats, setWatchStats] = useState(null)
    const [libStats, setLibStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([getWatchStats(), getStats()])
            .then(([ws, ls]) => {
                setWatchStats(ws)
                setLibStats(ls)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const totalWatchHours = watchStats?.total_watch_hours ?? 0
    const totalWatched = watchStats?.total_videos_watched ?? 0
    const favCount = watchStats?.favorites_count ?? 0
    const totalVids = watchStats?.total_videos ?? libStats?.total_videos ?? 0

    return (
        <div className="min-h-screen" style={{ background: 'var(--c-bg)' }}>
            {/* Background orbs */}
            <div className="orb w-[500px] h-[500px] bg-violet-700 top-0 -left-32" />
            <div className="orb w-96 h-96 bg-cyan-700 top-80 right-0" />

            <Navbar />

            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-10"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                        <span className="text-[10px] text-violet-300 font-bold uppercase tracking-[0.2em]">Watch Analytics</span>
                    </div>
                    <h1 className="text-4xl font-black font-['Space_Grotesk'] text-white">Your Statistics</h1>
                    <p className="text-slate-500 mt-1">A breakdown of your viewing habits across your library.</p>
                </motion.div>

                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="skeleton h-28 rounded-2xl" />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Stat Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                            <StatCard
                                icon="⏳"
                                label="Total Watch Time"
                                value={<AnimCounter value={totalWatchHours} suffix="h" decimals={1} />}
                                sub={`${formatDuration((watchStats?.total_watch_secs ?? 0))} total`}
                                color="bg-violet-500/15"
                                delay={0}
                            />
                            <StatCard
                                icon="🎬"
                                label="Videos Watched"
                                value={<AnimCounter value={totalWatched} />}
                                sub={`out of ${totalVids} in library`}
                                color="bg-cyan-500/15"
                                delay={0.07}
                            />
                            <StatCard
                                icon="♥"
                                label="Favorites"
                                value={<AnimCounter value={favCount} />}
                                sub="videos marked favorite"
                                color="bg-pink-500/15"
                                delay={0.14}
                            />
                            <StatCard
                                icon="📂"
                                label="Categories"
                                value={<AnimCounter value={watchStats?.category_breakdown?.length ?? 0} />}
                                sub="genres explored"
                                color="bg-amber-500/15"
                                delay={0.21}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Top videos */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.45 }}
                                className="glass rounded-2xl p-6"
                            >
                                <div className="flex items-center gap-2 mb-5">
                                    <span className="text-lg">🏆</span>
                                    <h2 className="text-base font-bold text-white font-['Space_Grotesk']">Most Watched</h2>
                                    <span className="text-xs bg-violet-500/15 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5 font-bold ml-auto">
                                        Top {Math.min(10, watchStats?.top_videos?.length ?? 0)}
                                    </span>
                                </div>
                                {watchStats?.top_videos?.length > 0 ? (
                                    <div className="space-y-1">
                                        {watchStats.top_videos.map((v, i) => (
                                            <TopVideoRow key={v.id} video={v} rank={i} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center py-12 text-center">
                                        <div className="text-4xl mb-3">🎬</div>
                                        <p className="text-slate-400 font-semibold">No watch history yet</p>
                                        <p className="text-slate-600 text-sm mt-1">Start watching videos to see your stats here.</p>
                                    </div>
                                )}
                            </motion.div>

                            {/* Category breakdown */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.38, duration: 0.45 }}
                                className="glass rounded-2xl p-6"
                            >
                                <div className="flex items-center gap-2 mb-5">
                                    <span className="text-lg">📊</span>
                                    <h2 className="text-base font-bold text-white font-['Space_Grotesk']">Time by Category</h2>
                                </div>
                                {watchStats?.category_breakdown?.length > 0 ? (
                                    <CategoryChart data={watchStats.category_breakdown} />
                                ) : (
                                    <div className="flex flex-col items-center py-12 text-center">
                                        <div className="text-4xl mb-3">📂</div>
                                        <p className="text-slate-400 font-semibold">No data yet</p>
                                        <p className="text-slate-600 text-sm mt-1">Watch some videos to build your category stats.</p>
                                    </div>
                                )}

                                {/* Watch completion ring (simple) */}
                                {totalVids > 0 && (
                                    <div className="mt-8 pt-5 border-t border-white/[0.05] flex items-center gap-4">
                                        <div className="relative w-16 h-16 shrink-0">
                                            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                                                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                                                <motion.circle
                                                    cx="32" cy="32" r="26"
                                                    fill="none"
                                                    stroke="url(#statsGrad)"
                                                    strokeWidth="6"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${2 * Math.PI * 26}`}
                                                    initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                                                    animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - Math.min(1, totalWatched / totalVids)) }}
                                                    transition={{ delay: 0.5, duration: 1.2, ease: 'easeOut' }}
                                                />
                                                <defs>
                                                    <linearGradient id="statsGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                        <stop offset="0%" stopColor="#8b5cf6" />
                                                        <stop offset="100%" stopColor="#06b6d4" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-xs font-black text-white">
                                                    {Math.round(Math.min(100, (totalWatched / totalVids) * 100))}%
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-200">Library Coverage</p>
                                            <p className="text-xs text-slate-500">{totalWatched} of {totalVids} videos watched</p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>

                        {/* Creator Signature */}
                        <div className="mt-16 mb-8 flex justify-center w-full">
                            <div className="relative group cursor-default">
                                <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg blur opacity-20 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative px-6 py-3 bg-black/40 ring-1 ring-white/10 backdrop-blur-sm rounded-lg flex items-center gap-3">
                                    <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-violet-500 to-cyan-500 animate-pulse"></div>
                                    <span className="text-slate-400 text-sm font-medium tracking-wide">Architected &amp; Engineered by</span>
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 font-black tracking-widest text-lg font-['Space_Grotesk']">
                                        SHREERAJ
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
