import React, { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getStats } from '../api'
import FolderManager from './FolderManager'

export default function Navbar({ onSearch, onLibraryRefresh }) {
    const [query, setQuery] = useState('')
    const [stats, setStats] = useState(null)
    const [showFolderMgr, setShowFolderMgr] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const location = useLocation()
    const isHome = location.pathname === '/'

    const loadStats = useCallback(() => {
        getStats().then(setStats).catch(() => { })
    }, [])

    useEffect(() => {
        loadStats()
        const interval = setInterval(loadStats, 15000)
        return () => clearInterval(interval)
    }, [loadStats])

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 10)
        window.addEventListener('scroll', handler, { passive: true })
        return () => window.removeEventListener('scroll', handler)
    }, [])

    useEffect(() => {
        const t = setTimeout(() => onSearch && onSearch(query), 280)
        return () => clearTimeout(t)
    }, [query, onSearch])

    const handleScanComplete = () => {
        loadStats()
        onLibraryRefresh && onLibraryRefresh()
    }

    return (
        <>
            <header className={`sticky top-0 z-50 transition-all duration-300
                ${scrolled ? 'glass border-b border-violet-500/15 shadow-xl shadow-black/30' : 'bg-transparent'}`}>
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
                    {/* Logo — PIXNEST */}
                    <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
                        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600
                            flex items-center justify-center shadow-lg shadow-violet-600/30
                            group-hover:shadow-violet-500/50 transition-all group-hover:scale-105">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v5a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm0 9a2 2 0 012-2h4a2 2 0 012 2v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1zm10 0a2 2 0 012-2h.5a2 2 0 010 4H16a2 2 0 01-2-2zm-4 0a1 1 0 100 2 1 1 0 000-2z" />
                            </svg>
                        </div>
                        <div className="hidden sm:flex flex-col items-start translate-y-0.5">
                            <span className="text-base font-black flex items-center gap-3">
                                <span className="gradient-text font-['Space_Grotesk'] tracking-widest uppercase">PHANTOM</span>
                                <span className="px-2 py-[2px] rounded-md bg-violet-900/40 border border-violet-500/30 text-[10px] font-mono text-violet-300 tracking-wider shadow-[0_0_10px_rgba(139,92,246,0.2)]">
                                    v1.0.4-stable-shreeraj
                                </span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold tracking-[0.2em] uppercase mt-0.5">LAN · MEDIA</span>
                        </div>
                    </Link>

                    {/* Search */}
                    {isHome && (
                        <div className="flex-1 max-w-xl relative">
                            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                            </svg>
                            <input
                                id="search-input"
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search your library…"
                                className="input-field w-full pl-10 pr-10 py-2.5 text-sm"
                            />
                            {query && (
                                <button onClick={() => setQuery('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 ml-auto shrink-0">
                        {/* Stats chips */}
                        {stats && (
                            <div className="hidden lg:flex items-center gap-1.5">
                                <div className="tooltip-wrap">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs cursor-default">
                                        <span className="text-violet-400 font-bold">{stats.total_videos}</span>
                                        <span className="text-slate-500">videos</span>
                                    </div>
                                    <span className="tooltip-box-bottom">Total videos in library</span>
                                </div>
                                <div className="tooltip-wrap">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs cursor-default">
                                        <span className="text-cyan-400 font-bold">{stats.total_size_gb}</span>
                                        <span className="text-slate-500">GB</span>
                                    </div>
                                    <span className="tooltip-box-bottom">Total library size</span>
                                </div>
                                {stats.total_folders > 0 && (
                                    <div className="tooltip-wrap">
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs cursor-default">
                                            <span className="text-amber-400 font-bold">{stats.total_folders}</span>
                                            <span className="text-slate-500">folders</span>
                                        </div>
                                        <span className="tooltip-box-bottom">Watched folders</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Add Folder */}
                        <button
                            id="add-folder-nav-btn"
                            onClick={() => setShowFolderMgr(true)}
                            className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            <span className="hidden sm:inline">Add Folder</span>
                        </button>
                    </div>
                </div>
            </header>

            {showFolderMgr && (
                <FolderManager
                    onClose={() => setShowFolderMgr(false)}
                    onScanComplete={handleScanComplete}
                />
            )}
        </>
    )
}
