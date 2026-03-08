import React, { useState, useEffect, useCallback, useRef } from 'react'
import Navbar from '../components/Navbar'
import VideoCard, { VideoListCard, VideoCardSkeleton } from '../components/VideoCard'
import { getVideos, searchVideos, getInProgressVideos, getStats } from '../api'

const SORTS = [
    { key: 'date_added', label: 'Recently Added' },
    { key: 'name', label: 'Name A–Z' },
    { key: 'duration', label: 'Duration' },
    { key: 'size', label: 'File Size' },
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
        <div className="glass-card rounded-2xl px-4 py-4 flex items-center gap-3 animate-slide-up hover:scale-105 transition-transform cursor-default">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${color.replace('text-', 'bg-').replace('400', '500/10')}`}>
                {icon}
            </div>
            <div>
                <p className={`text-2xl font-black font-['Space_Grotesk'] ${color}`}>{display}</p>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{label}</p>
            </div>
        </div>
    )
}

// ── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection({ videos, stats }) {
    const typedText = useTypingEffect(['LAN YouTube', 'Your Library', 'Any Drive', 'Any Folder'], 95, 2000)
    const featured = videos.find(v => v.duration > 60) || videos[0]

    return (
        <div className="relative overflow-hidden rounded-3xl mb-10 hero-gradient border border-white/[0.04] animate-fade-in">
            {featured && (
                <div className="absolute inset-0 opacity-15">
                    <img src={featured.thumbnail_url} alt="" className="w-full h-full object-cover"
                        style={{ filter: 'blur(30px)', transform: 'scale(1.3)' }} />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#06060f] via-[#06060f]/80 to-[#06060f]/60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#06060f] via-transparent to-transparent" />
                </div>
            )}

            <div className="relative flex flex-col lg:flex-row items-center gap-8 px-6 py-10 lg:px-12 lg:py-12">
                {/* Left side */}
                <div className="flex-1 space-y-6 text-center lg:text-left">
                    <div>
                        <p className="text-xs text-violet-400 font-black uppercase tracking-[0.25em] mb-3 flex items-center justify-center lg:justify-start gap-2">
                            <span className="w-4 h-px bg-violet-500 inline-block" />
                            PHANTOM · MEDIA CORE
                            <span className="w-4 h-px bg-violet-500 inline-block" />
                        </p>
                        <h1 className="text-4xl lg:text-6xl font-black font-['Space_Grotesk'] text-white leading-[1.05]">
                            Stream
                        </h1>
                        <h1 className="text-4xl lg:text-6xl font-black font-['Space_Grotesk'] leading-[1.05]">
                            <span className="gradient-text typing-cursor">{typedText}</span>
                        </h1>
                    </div>

                    {stats && (
                        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto lg:mx-0">
                            <StatCounter value={stats.total_videos} label="Videos" color="text-violet-400" icon="🎬" />
                            <StatCounter value={stats.total_size_gb} label="GB" color="text-cyan-400" icon="💾" />
                            <StatCounter value={stats.categories?.length || 0} label="Genres" color="text-amber-400" icon="🎭" />
                        </div>
                    )}

                    {!stats || stats.total_videos === 0 ? (
                        <div className="flex items-center justify-center lg:justify-start gap-2 text-sm text-slate-500">
                            <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
                            </svg>
                            Click <strong className="text-violet-400 mx-1">+ Add Folder</strong> to add movies from any drive
                        </div>
                    ) : null}
                </div>

                {/* Featured card */}
                {featured && (
                    <div className="w-full lg:w-72 shrink-0">
                        <p className="text-[10px] text-violet-400 font-black uppercase tracking-widest mb-2 text-center">🎯 Featured</p>
                        <a href={`/player/${featured.id}`}
                            className="block relative rounded-2xl overflow-hidden cursor-pointer group
                                ring-1 ring-violet-500/20 shadow-2xl shadow-violet-900/30
                                hover:ring-violet-500/50 transition-all duration-300">
                            <img src={featured.thumbnail_url} alt=""
                                className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="w-16 h-16 rounded-full bg-violet-600/90 flex items-center justify-center shadow-2xl shadow-violet-600/50">
                                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </div>
                            </div>
                            <p className="absolute bottom-0 left-0 right-0 p-4 text-white font-semibold text-sm line-clamp-1">
                                {featured.filename.replace(/\.[^/.]+$/, '')}
                            </p>
                        </a>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Continue Watching Row ─────────────────────────────────────────────────────
function ContinueWatchingRow({ videos }) {
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
                {videos.map(v => <VideoCard key={v.id} video={v} />)}
            </div>
        </section>
    )
}

// ── Category Section (vertical grid) ─────────────────────────────────────────
function CategorySection({ category, videos, emoji }) {
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
                    {videos.map(v => <VideoCard key={v.id} video={v} />)}
                </div>
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

    const displayed = activeCategory === 'All'
        ? videos
        : videos.filter(v => v.category === activeCategory)

    const isSearching = !!searchQuery

    // Group by category for sections (only in All + grid)
    const showByCat = !isSearching && activeCategory === 'All' && viewMode === 'grid'
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
                            <ContinueWatchingRow videos={inProgress} />
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

                            <div className="flex items-center gap-2 shrink-0">
                                <select value={sort} onChange={e => setSort(e.target.value)}
                                    className="input-field text-sm px-3 py-2 cursor-pointer text-slate-300 bg-transparent">
                                    {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </select>

                                {/* View toggle */}
                                <div className="flex rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.03]">
                                    {[
                                        { mode: 'grid', icon: <rect x="3" y="3" width="7" height="7" rx="1" />, label: 'Grid' },
                                        { mode: 'list', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />, label: 'List' },
                                    ].map(({ mode, icon, label }) => (
                                        <button key={mode}
                                            onClick={() => setViewMode(mode)}
                                            title={label}
                                            className={`px-3 py-2.5 transition-all ${viewMode === mode
                                                ? 'bg-violet-600/40 text-violet-300'
                                                : 'text-slate-500 hover:text-slate-300'}`}>
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
                        {(isSearching || activeCategory !== 'All') && (
                            <p className="text-sm text-slate-500 mb-4">
                                {displayed.length} {displayed.length === 1 ? 'video' : 'videos'}
                                {isSearching && <span className="text-violet-400"> matching "{searchQuery}"</span>}
                                {activeCategory !== 'All' && <span> in <span className="text-violet-400">{activeCategory}</span></span>}
                            </p>
                        )}

                        {/* Empty state */}
                        {displayed.length === 0 && !isSearching && (
                            <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
                                <div className="text-7xl mb-4">🎬</div>
                                <p className="text-slate-200 font-bold text-2xl mb-2">No videos yet</p>
                                <p className="text-slate-500 text-sm max-w-sm">
                                    Click <strong className="text-violet-400">+ Add Folder</strong> in the top bar to start streaming from any drive — no moving files needed.
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

                        {/* Netflix-style category sections (All + grid + no search) */}
                        {showByCat && Object.entries(categoryMap).map(([cat, vids]) => (
                            <CategorySection
                                key={cat}
                                category={cat}
                                videos={vids}
                                emoji={CATEGORY_EMOJIS[cat]}
                            />
                        ))}

                        {/* Filtered grid */}
                        {!showByCat && displayed.length > 0 && viewMode === 'grid' && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger animate-fade-in">
                                {displayed.map(v => <VideoCard key={v.id} video={v} />)}
                            </div>
                        )}

                        {/* List view */}
                        {displayed.length > 0 && viewMode === 'list' && (
                            <div className="flex flex-col gap-2 stagger">
                                {displayed.map(v => <VideoListCard key={v.id} video={v} />)}
                            </div>
                        )}

                        {/* Creator Signature */}
                        <div className="mt-20 mb-8 flex justify-center w-full">
                            <div className="relative group cursor-default">
                                <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg blur opacity-20 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative px-6 py-3 bg-black/40 ring-1 ring-white/10 backdrop-blur-sm rounded-lg flex items-center gap-3">
                                    <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-violet-500 to-cyan-500 animate-pulse"></div>
                                    <span className="text-slate-400 text-sm font-medium tracking-wide">
                                        Architected & Engineered by
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
        </div>
    )
}
