import React, { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
const MotionLink = motion(Link)
import { getStats } from '../api'
import FolderManager from './FolderManager'
import PlaylistManager from './PlaylistManager'
import ThemeSwitcher from './ThemeSwitcher'

export default function Navbar({ onSearch, onLibraryRefresh }) {
    const [query, setQuery] = useState('')
    const [stats, setStats] = useState(null)
    const [showFolderMgr, setShowFolderMgr] = useState(false)
    const [showPlaylistMgr, setShowPlaylistMgr] = useState(false)
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
            <header className="sticky top-0 z-50 pt-2 sm:pt-4 pb-2 transition-all duration-500">
                <div className={`mx-auto transition-all duration-500 flex items-center gap-4 ${scrolled ? 'max-w-6xl rounded-2xl glass border border-white/10 shadow-2xl shadow-violet-900/30 px-4 py-2' : 'max-w-screen-2xl px-4 sm:px-6 py-2 bg-transparent'}`}>
                    {/* Logo */}
                    <MotionLink whileTap={{ scale: 0.95 }} to="/" className="flex items-center gap-2.5 shrink-0 group">
                        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-500
                            flex items-center justify-center shadow-lg shadow-violet-600/40
                            group-hover:shadow-violet-500/60 transition-all group-hover:scale-105 group-hover:rotate-3">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v5a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm0 9a2 2 0 012-2h4a2 2 0 012 2v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1zm10 0a2 2 0 012-2h.5a2 2 0 010 4H16a2 2 0 01-2-2zm-4 0a1 1 0 100 2 1 1 0 000-2z" />
                            </svg>
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
                    </MotionLink>

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

                    <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d1f]/95 backdrop-blur-md border-t border-violet-500/20 p-2 sm:p-0 flex items-center gap-2 overflow-x-auto sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-none sm:justify-start sm:overflow-visible sm:ml-auto shrink-0 z-50 pb-safe pb-4 sm:pb-0 hide-scrollbar px-2 sm:px-0">
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
                                {stats.total_favorites > 0 && (
                                    <div className="tooltip-wrap">
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs cursor-default">
                                            <span className="text-red-400 font-bold">♥ {stats.total_favorites}</span>
                                        </div>
                                        <span className="tooltip-box-bottom">Favorited videos</span>
                                    </div>
                                )}
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

                        {/* Files */}
                        <MotionLink
                            whileTap={{ scale: 0.95 }}
                            to="/files"
                            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 text-sm font-semibold rounded-xl transition-all duration-300 min-w-[70px] sm:min-w-0 border ${
                                location.pathname === '/files'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-300'
                            }`}
                            title="LAN File Share"
                        >
                            <span className="sm:inline">Files</span>
                        </MotionLink>

                        {/* Chat */}
                        <MotionLink
                            whileTap={{ scale: 0.95 }}
                            to="/chat"
                            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 text-sm font-semibold rounded-xl transition-all duration-300 min-w-[70px] sm:min-w-0 border ${
                                location.pathname === '/chat'
                                ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                                : 'bg-pink-500/10 text-pink-400 border-pink-500/15 hover:bg-pink-500/20 hover:border-pink-500/30 hover:text-pink-300'
                            }`}
                            title="LAN Chat"
                        >
                            <span className="sm:inline">Chat</span>
                        </MotionLink>

                        {/* LAN Social Hub */}
                        <MotionLink
                            whileTap={{ scale: 0.95 }}
                            to="/lan"
                            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 text-sm font-semibold rounded-xl transition-all duration-300 min-w-[70px] sm:min-w-0 border ${
                                location.pathname === '/lan'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/15 hover:bg-blue-500/20 hover:border-blue-500/30 hover:text-blue-300'
                            }`}
                            title="LAN Social Hub"
                        >
                            <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="hidden sm:inline">LAN Social Hub</span>
                        </MotionLink>

                        <MotionLink
                            whileTap={{ scale: 0.95 }}
                            id="history-nav-btn"
                            to="/history"
                            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 text-sm font-semibold rounded-xl transition-all duration-300 min-w-[70px] sm:min-w-0 border ${
                                location.pathname === '/history'
                                ? 'bg-slate-500/20 text-slate-200 border-slate-500/40 shadow-[0_0_15px_rgba(148,163,184,0.2)]'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/15 hover:bg-slate-500/20 hover:border-slate-500/30 hover:text-slate-200'
                            }`}
                            title="Watch History"
                        >
                            <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="hidden sm:inline">History</span>
                        </MotionLink>

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            id="add-folder-nav-btn"
                            onClick={() => setShowFolderMgr(true)}
                            className="btn-primary flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 text-sm font-semibold rounded-xl shrink-0"
                        >
                            <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            <span className="hidden sm:inline">Add</span>
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowPlaylistMgr(true)}
                            className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 text-sm font-semibold rounded-xl
                                bg-cyan-600/15 text-cyan-400 border border-cyan-500/15 hover:bg-cyan-600/25 
                                hover:border-cyan-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 shrink-0"
                        >
                            <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            <span className="hidden sm:inline">Playlists</span>
                        </motion.button>

                        <ThemeSwitcher />
                    </div>
                </div>
            </header>

            {showFolderMgr && (
                <FolderManager
                    onClose={() => setShowFolderMgr(false)}
                    onScanComplete={handleScanComplete}
                />
            )}

            {showPlaylistMgr && (
                <PlaylistManager
                    onClose={() => setShowPlaylistMgr(false)}
                />
            )}
        </>
    )
}
