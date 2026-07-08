import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import VideoCard, { VideoListCard, VideoCardSkeleton } from '../components/VideoCard'
import { getVideos, searchVideos, getInProgressVideos, getStats, clearVideoHistory } from '../api'
import PlaylistManager from '../components/PlaylistManager'

export const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const SORTS = [
    { key: 'date_added', label: 'Recently Added' },
    { key: 'name', label: 'Name A–Z' },
    { key: 'duration', label: 'Duration' },
    { key: 'size', label: 'File Size' },
    { key: 'favorites', label: '♥ Favorites' },
]

// ── Typing animation hook ────────────────────────────────────────────────────
function useTypingEffect(words, speed = 100, pause = 1800) {
    const [display, setDisplay] = useState('')
    const [wordIdx, setWordIdx] = useState(0)
    const [charIdx, setCharIdx] = useState(0)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        const word = words[wordIdx]
        let timeout

        if (!deleting && charIdx <= word.length) {
            timeout = setTimeout(() => setCharIdx(i => i + 1), speed)
        } else if (!deleting && charIdx > word.length) {
            timeout = setTimeout(() => setDeleting(true), pause)
        } else if (deleting && charIdx > 0) {
            timeout = setTimeout(() => setCharIdx(i => i - 1), speed / 2)
        } else {
            setDeleting(false)
            setWordIdx(i => (i + 1) % words.length)
        }

        setDisplay(word.slice(0, charIdx))
        return () => clearTimeout(timeout)
    }, [charIdx, deleting, wordIdx, words, speed, pause])

    return display
}

// ── Animated stat counter ────────────────────────────────────────────────────
function StatCounter({ value, label, color, icon }) {
    const [display, setDisplay] = useState(0)

    useEffect(() => {
        if (!value) return
        const target = parseFloat(value)
        const steps = 35
        const step = target / steps
        let current = 0
        const timer = setInterval(() => {
            current = Math.min(current + step, target)
            setDisplay(Number.isInteger(target) ? Math.round(current) : current.toFixed(1))
            if (current >= target) clearInterval(timer)
        }, 22)
        return () => clearInterval(timer)
    }, [value])

    return (
        <div className="glass-card rounded-2xl px-6 py-4 flex items-center gap-4 animate-slide-up hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 cursor-default group flex-1 min-w-[140px]">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${color.replace('text-', 'bg-').replace('400', '500/15')} border border-white/5 group-hover:scale-110 transition-transform duration-300`}>
                <span className={color}>{icon}</span>
            </div>
            <div>
                <p className={`text-3xl font-black font-['Space_Grotesk'] ${color}`}>{display}</p>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.1em]">{label}</p>
            </div>
        </div>
    )
}

// ── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection({ videos, stats }) {
    const typedText = useTypingEffect(['LAN YouTube', 'Your Library', 'Any Drive', 'Any Folder'], 95, 2000)
    const featured = videos.find(v => v.duration > 60) || videos[0]

    return (
        <div className="relative overflow-hidden rounded-[2.5rem] mb-12 hero-gradient border border-white/10 animate-fade-in shadow-[0_20px_60px_-15px_rgba(139,92,246,0.3)]">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 via-transparent to-cyan-900/10" />
            
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-600/30 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-600/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

            {featured && (
                <div className="absolute inset-0 opacity-30">
                    <img src={featured.thumbnail_url} alt="" className="w-full h-full object-cover mix-blend-overlay"
                        style={{ filter: 'blur(40px)', transform: 'scale(1.2)' }} />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#06060f] via-[#06060f]/80 to-[#06060f]/40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#06060f] via-transparent to-transparent" />
                </div>
            )}

            <div className="relative flex flex-col lg:flex-row items-center gap-10 px-8 py-12 lg:px-16 lg:py-20">
                {/* Left side */}
                <div className="flex-1 space-y-8 text-center lg:text-left z-10">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                            <span className="text-[10px] text-violet-300 font-bold uppercase tracking-[0.2em]">Phantom Media Core</span>
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black font-['Space_Grotesk'] text-white leading-[1.05] tracking-tight">
                            Stream
                        </h1>
                        <h1 className="text-5xl lg:text-7xl font-black font-['Space_Grotesk'] leading-[1.05] tracking-tight mt-2">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 typing-cursor">{typedText}</span>
                        </h1>
                    </div>

                    {stats && (
                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                            <StatCounter value={stats.total_videos} label="Videos" color="text-violet-400" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>} />
                            <StatCounter value={stats.total_size_gb} label="GB" color="text-cyan-400" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>} />
                            <StatCounter value={stats.categories?.length || 0} label="Genres" color="text-amber-400" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} />
                        </div>
                    )}

                    {!stats || stats.total_videos === 0 ? (
                        <div className="flex items-center justify-center lg:justify-start gap-2 text-sm text-slate-400 bg-white/5 w-fit mx-auto lg:mx-0 px-4 py-2 rounded-lg border border-white/10">
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
                            </svg>
                            Click <strong className="text-violet-300 mx-1">+ Add Folder</strong> to add movies from any drive
                        </div>
                    ) : null}
                </div>

                {/* Featured card */}
                {featured && (
                    <div className="w-full lg:w-[340px] shrink-0 z-10">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-3xl blur opacity-20 group-hover:opacity-50 transition duration-500" />
                            <a href={`/player/${featured.id}`}
                                className="block relative rounded-2xl overflow-hidden cursor-pointer
                                    bg-[#0d0d1f] border border-white/10 shadow-2xl
                                    transform transition-all duration-500 hover:scale-[1.02] hover:-rotate-1">
                                <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5 text-[10px] text-violet-300 font-bold uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                    Featured
                                </div>
                                <img src={featured.thumbnail_url} alt=""
                                    className="w-full aspect-video object-cover group-hover:scale-110 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#06060f] via-[#06060f]/20 to-transparent opacity-90" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transform group-hover:scale-110 transition-all duration-300 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                                        <svg className="w-8 h-8 text-white ml-1 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-5">
                                    <p className="text-white font-bold text-lg leading-tight line-clamp-1 drop-shadow-md">
                                        {featured.filename.replace(/\.[^/.]+$/, '')}
                                    </p>
                                </div>
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Continue Watching Row ─────────────────────────────────────────────────────
function ContinueWatchingRow({ videos, onAddToPlaylist, onFavoriteToggle, onRemoveHistory }) {
    if (!videos || videos.length === 0) return null

    return (
        <section className="mb-10 animate-fade-in">
            <div className="section-header">
                <div className="flex items-center gap-2">
                    <span className="text-base">⏱</span>
                    <h2>Continue Watching</h2>
                    <span className="text-xs bg-violet-500/15 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5 font-bold">
                        {videos.length}
                    </span>
                </div>
                <div className="section-line" />
            </div>
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
                {videos.map(v => <VideoCard key={v.id} video={v} onAddToPlaylist={onAddToPlaylist} onFavoriteToggle={onFavoriteToggle} onRemoveHistory={onRemoveHistory} />)}
            </motion.div>
        </section>
    )
}

// ── Category Section (vertical grid) ─────────────────────────────────────────
function CategorySection({ category, videos, emoji, onAddToPlaylist, onFavoriteToggle, onRemoveHistory }) {
    const [collapsed, setCollapsed] = useState(false)

    return (
        <section className="mb-10">
            <div className="section-header cursor-pointer select-none" onClick={() => setCollapsed(c => !c)}>
                <div className="flex items-center gap-2">
                    {emoji && <span className="text-base">{emoji}</span>}
                    <div className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full" />
                    <h2>{category}</h2>
                    <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 font-bold">
                        {videos.length}
                    </span>
                </div>
                <div className="section-line" />
                <button className="shrink-0 text-slate-600 hover:text-violet-400 transition-colors">
                    <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
            {!collapsed && (
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
                    {videos.map(v => <VideoCard key={v.id} video={v} onAddToPlaylist={onAddToPlaylist} onFavoriteToggle={onFavoriteToggle} onRemoveHistory={onRemoveHistory} />)}
                </motion.div>
            )}
        </section>
    )
}

const CATEGORY_EMOJIS = {
    'Uncategorized': '📁',
    'Action': '💥', 'Comedy': '😂', 'Drama': '🎭', 'Horror': '👻',
    'Sci-Fi': '🚀', 'Thriller': '🔍', 'Romance': '❤️', 'Animation': '🎨',
    'Documentary': '🎥', 'Fantasy': '🧙', 'Crime': '🕵️', 'Sports': '⚽',
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
    const [videos, setVideos] = useState([])
    const [inProgress, setInProgress] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState('All')
    const [sort, setSort] = useState('date_added')
    const [viewMode, setViewMode] = useState('grid')
    const [playlistVideo, setPlaylistVideo] = useState(null)
    const loadedRef = useRef(false)

    const categories = ['All', ...[...new Set(videos.map(v => v.category))].sort()]

    const fetchAll = useCallback(async () => {
        // On first load show skeleton; on refresh don't flash skeleton
        if (!loadedRef.current) setLoading(true)
        setError(null)
        try {
            const [data, progress, s] = await Promise.all([
                getVideos(sort),
                getInProgressVideos(),
                getStats(),
            ])
            setVideos(data)
            setInProgress(progress)
            setStats(s)
            loadedRef.current = true
        } catch {
            setError('Could not connect to server. Is the backend running?')
        } finally {
            setLoading(false)
        }
    }, [sort])

    useEffect(() => {
        loadedRef.current = false
        fetchAll()
    }, [fetchAll])

    const handleSearch = useCallback(async (q) => {
        setSearchQuery(q)
        if (!q) { fetchAll(); return }
        try {
            const data = await searchVideos(q)
            setVideos(data)
        } catch { /* silent */ }
    }, [fetchAll])

    const handleRemoveHistory = useCallback(async (video) => {
        try {
            await clearVideoHistory(video.id)
            fetchAll()
        } catch { /* silent */ }
    }, [fetchAll])

    const displayed = activeCategory === 'All'
        ? videos
        : videos.filter(v => v.category === activeCategory)

    const isSearching = !!searchQuery

    // Group by category for sections (only in All + grid + not favorites sort)
    const showByCat = !isSearching && activeCategory === 'All' && viewMode === 'grid' && sort !== 'favorites'
    const categoryMap = {}
    if (showByCat) {
        for (const v of videos) {
            const cat = v.category || 'Uncategorized'
            if (!categoryMap[cat]) categoryMap[cat] = []
            categoryMap[cat].push(v)
        }
    }

    return (
        <div className="min-h-screen" style={{ background: 'var(--c-bg)' }}>
            {/* Background orbs */}
            <div className="orb w-[500px] h-[500px] bg-violet-700 top-0 -left-32" />
            <div className="orb w-96 h-96 bg-cyan-700 top-80 right-0" />

            <Navbar onSearch={handleSearch} onLibraryRefresh={fetchAll} />

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 relative z-10">
                {/* Error */}
                {error && (
                    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
                        <div className="text-6xl mb-4">⚠️</div>
                        <p className="text-red-400 font-bold text-xl mb-2">Connection failed</p>
                        <p className="text-slate-500 text-sm mb-6">{error}</p>
                        <button onClick={fetchAll} className="btn-primary px-6 py-2.5 text-sm font-bold">Retry</button>
                    </div>
                )}

                {/* Skeleton */}
                {loading && !error && (
                    <>
                        <div className="skeleton h-64 rounded-3xl mb-10" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {Array.from({ length: 12 }).map((_, i) => <VideoCardSkeleton key={i} />)}
                        </div>
                    </>
                )}

                {!loading && !error && (
                    <>
                        {/* Hero */}
                        {!isSearching && (
                            <HeroSection videos={videos} stats={stats} />
                        )}

                        {/* Continue Watching */}
                        {!isSearching && inProgress.length > 0 && (
                            <ContinueWatchingRow
                                videos={inProgress}
                                onAddToPlaylist={setPlaylistVideo}
                                onFavoriteToggle={fetchAll}
                                onRemoveHistory={handleRemoveHistory}
                            />
                        )}

                        {/* Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                            {/* Category pills */}
                            <div className="flex flex-wrap gap-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        id={`cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`pill ${activeCategory === cat ? 'active' : ''}`}
                                    >
                                        {CATEGORY_EMOJIS[cat] && <span className="mr-1">{CATEGORY_EMOJIS[cat]}</span>}
                                        {cat}
                                        {activeCategory === cat && (
                                            <span className="ml-1.5 text-[10px] font-bold opacity-70">
                                                {displayed.length}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <select value={sort} onChange={e => setSort(e.target.value)}
                                    className="input-field text-sm px-4 py-2.5 cursor-pointer text-slate-300 bg-transparent rounded-xl border border-white/[0.08]">
                                    {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </select>

                                {/* View toggle */}
                                <div className="flex rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.03] shadow-inner">
                                    {[
                                        { mode: 'grid', icon: <rect x="3" y="3" width="7" height="7" rx="1" />, label: 'Grid' },
                                        { mode: 'list', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />, label: 'List' },
                                    ].map(({ mode, icon, label }) => (
                                        <button key={mode}
                                            onClick={() => setViewMode(mode)}
                                            title={label}
                                            className={`px-3.5 py-2.5 transition-all duration-200 ${viewMode === mode
                                                ? 'bg-gradient-to-r from-violet-600/50 to-violet-500/40 text-violet-200 shadow-lg shadow-violet-900/30'
                                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'}`}>
                                            <svg className="w-4 h-4" fill={mode === 'grid' ? 'currentColor' : 'none'}
                                                stroke={mode === 'list' ? 'currentColor' : 'none'}
                                                strokeWidth={mode === 'list' ? 2 : 0}
                                                viewBox="0 0 24 24">
                                                {icon}
                                                {mode === 'grid' && <>
                                                    <rect x="14" y="3" width="7" height="7" rx="1" />
                                                    <rect x="3" y="14" width="7" height="7" rx="1" />
                                                    <rect x="14" y="14" width="7" height="7" rx="1" />
                                                </>}
                                            </svg>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Result count */}
                        {(isSearching || activeCategory !== 'All' || sort === 'favorites') && (
                            <p className="text-sm text-slate-500 mb-4">
                                {displayed.length} {displayed.length === 1 ? 'video' : 'videos'}
                                {isSearching && <span className="text-violet-400"> matching "{searchQuery}"</span>}
                                {activeCategory !== 'All' && <span> in <span className="text-violet-400">{activeCategory}</span></span>}
                                {sort === 'favorites' && !isSearching && <span className="text-red-400"> ♥ favorited</span>}
                            </p>
                        )}

                        {/* Empty state */}
                        {displayed.length === 0 && !isSearching && sort !== 'favorites' && (
                            <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
                                <div className="text-7xl mb-4">🎬</div>
                                <p className="text-slate-200 font-bold text-2xl mb-2">No videos yet</p>
                                <p className="text-slate-500 text-sm max-w-sm">
                                    Click <strong className="text-violet-400">+ Add Folder</strong> in the top bar to start streaming from any drive — no moving files needed.
                                </p>
                            </div>
                        )}

                        {displayed.length === 0 && !isSearching && sort === 'favorites' && (
                            <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
                                <div className="text-7xl mb-4">♥</div>
                                <p className="text-slate-200 font-bold text-2xl mb-2">No favorites yet</p>
                                <p className="text-slate-500 text-sm max-w-sm">
                                    Hover any video card and click the heart icon to add it to your favorites.
                                </p>
                            </div>
                        )}

                        {displayed.length === 0 && isSearching && (
                            <div className="flex flex-col items-center py-24 text-center animate-fade-in">
                                <div className="text-5xl mb-4">🔍</div>
                                <p className="text-slate-300 font-bold text-xl mb-1">No results for "{searchQuery}"</p>
                                <p className="text-slate-500 text-sm">Try a different search term</p>
                            </div>
                        )}

                        {/* Netflix-style category sections (All + grid + no search + not favorites) */}
                        {showByCat && Object.entries(categoryMap).map(([cat, vids]) => (
                            <CategorySection
                                key={cat}
                                category={cat}
                                videos={vids}
                                emoji={CATEGORY_EMOJIS[cat]}
                                onAddToPlaylist={setPlaylistVideo}
                                onFavoriteToggle={fetchAll}
                                onRemoveHistory={handleRemoveHistory}
                            />
                        ))}

                        {/* Filtered / sorted grid */}
                        {!showByCat && displayed.length > 0 && viewMode === 'grid' && (
                            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
                                {displayed.map(v => <VideoCard key={v.id} video={v} onAddToPlaylist={setPlaylistVideo} onFavoriteToggle={fetchAll} onRemoveHistory={handleRemoveHistory} />)}
                            </motion.div>
                        )}

                        {/* List view */}
                        {displayed.length > 0 && viewMode === 'list' && (
                            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-2 stagger">
                                {displayed.map(v => <VideoListCard key={v.id} video={v} onAddToPlaylist={setPlaylistVideo} onFavoriteToggle={fetchAll} onRemoveHistory={handleRemoveHistory} />)}
                            </motion.div>
                        )}

                        {/* Creator Signature */}
                        <div className="mt-20 mb-8 flex justify-center w-full">
                            <div className="relative group cursor-default">
                                <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg blur opacity-20 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative px-6 py-3 bg-black/40 ring-1 ring-white/10 backdrop-blur-sm rounded-lg flex items-center gap-3">
                                    <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-violet-500 to-cyan-500 animate-pulse"></div>
                                    <span className="text-slate-400 text-sm font-medium tracking-wide">
                                        Architected &amp; Engineered by
                                    </span>
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 font-black tracking-widest text-lg font-['Space_Grotesk'] hover:scale-105 transition-transform duration-300">
                                        SHREERAJ
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {playlistVideo && (
                <PlaylistManager
                    videoId={playlistVideo.id}
                    onClose={() => setPlaylistVideo(null)}
                />
            )}
        </div>
    )
}
