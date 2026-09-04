import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Plyr from 'plyr'
import { getVideo, getVideos, getStreamUrl, getDownloadUrl, updateProgress, getHlsUrl, getBookmarks, addBookmark, deleteBookmark } from '../api'
import Hls from 'hls.js'

const SPEED_KEY = 'phantom_playback_speed'
const VOLUME_KEY = 'phantom_volume'
const MUTED_KEY = 'phantom_muted'

function formatDuration(secs) {
    if (!secs) return '0:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
}

function formatSize(bytes) {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB'
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
    return (bytes / 1e3).toFixed(0) + ' KB'
}

const SHORTCUTS = [
    { key: 'Space', label: 'Play / Pause' },
    { key: '← →', label: 'Seek ±5s' },
    { key: '↑ ↓', label: 'Volume' },
    { key: 'F', label: 'Fullscreen' },
    { key: 'M', label: 'Mute' },
    { key: 'K', label: 'Play / Pause' },
    { key: '0–9', label: 'Jump to %' },
]

function MetaBadge({ icon, children }) {
    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-slate-400">
            <span className="text-violet-400">{icon}</span>
            {children}
        </div>
    )
}

// Derive ambient color from thumbnail via canvas (simple center-pixel sample)
function useAmbientColor(thumbnailUrl) {
    const [color, setColor] = useState('139, 92, 246')
    useEffect(() => {
        if (!thumbnailUrl) return
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                canvas.width = 16
                canvas.height = 9
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, 16, 9)
                const d = ctx.getImageData(7, 4, 1, 1).data
                setColor(`${d[0]}, ${d[1]}, ${d[2]}`)
            } catch { /* cors fallback */ }
        }
        img.src = thumbnailUrl
    }, [thumbnailUrl])
    return color
}

// ── Sleep Timer Component ─────────────────────────────────────────────────────
const SLEEP_OPTIONS = [
    { label: '15 min', secs: 15 * 60 },
    { label: '30 min', secs: 30 * 60 },
    { label: '60 min', secs: 60 * 60 },
    { label: '90 min', secs: 90 * 60 },
]

function SleepTimer({ playerRef }) {
    const [open, setOpen] = useState(false)
    const [remaining, setRemaining] = useState(null) // secs
    const intervalRef = useRef(null)

    const start = (secs) => {
        clearInterval(intervalRef.current)
        setRemaining(secs)
        setOpen(false)
        intervalRef.current = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current)
                    // Pause the player
                    try { playerRef.current?.pause() } catch {}
                    return null
                }
                return prev - 1
            })
        }, 1000)
    }

    const cancel = () => {
        clearInterval(intervalRef.current)
        setRemaining(null)
        setOpen(false)
    }

    useEffect(() => () => clearInterval(intervalRef.current), [])

    const fmtCountdown = (secs) => {
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return `${m}:${String(s).padStart(2, '0')}`
    }

    return (
        <div className="relative">
            <button
                id="sleep-timer-btn"
                onClick={() => remaining !== null ? cancel() : setOpen(o => !o)}
                title={remaining !== null ? `Sleep timer: ${fmtCountdown(remaining)} — click to cancel` : 'Sleep Timer'}
                className={`action-chip ${remaining !== null ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : ''}`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                {remaining !== null
                    ? <span className="font-mono text-xs font-bold">{fmtCountdown(remaining)}</span>
                    : <span className="hidden sm:inline">Sleep</span>
                }
            </button>

            <AnimatePresence>
                {open && remaining === null && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 z-[200] glass rounded-xl border border-white/10 shadow-2xl p-3 min-w-[160px]"
                    >
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 px-1">Sleep after</p>
                        {SLEEP_OPTIONS.map(opt => (
                            <button
                                key={opt.secs}
                                onClick={() => start(opt.secs)}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-amber-500/15 hover:text-amber-300 transition-colors duration-150"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Bookmarks Panel ───────────────────────────────────────────────────────────
function BookmarksPanel({ videoId, playerRef, videoDuration }) {
    const [bookmarks, setBookmarks] = useState([])
    const [labelInput, setLabelInput] = useState('')
    const [adding, setAdding] = useState(false)
    const [showInput, setShowInput] = useState(false)

    const refresh = useCallback(() => {
        getBookmarks(videoId).then(setBookmarks).catch(() => {})
    }, [videoId])

    useEffect(() => { refresh() }, [refresh])

    const handleAdd = async () => {
        let currentTime = 0
        try { currentTime = playerRef.current?.currentTime || 0 } catch {}
        setAdding(true)
        try {
            await addBookmark(videoId, labelInput.trim() || formatDuration(currentTime), currentTime)
            setLabelInput('')
            setShowInput(false)
            refresh()
        } catch {}
        setAdding(false)
    }

    const handleDelete = async (id) => {
        await deleteBookmark(id).catch(() => {})
        refresh()
    }

    const seekTo = (secs) => {
        try {
            if (playerRef.current) {
                playerRef.current.currentTime = secs
                playerRef.current.play()
            }
        } catch {}
    }

    return (
        <div className="border-t border-white/[0.05] pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
                    🔖 Bookmarks {bookmarks.length > 0 && <span className="text-violet-400">({bookmarks.length})</span>}
                </p>
                <button
                    id="add-bookmark-btn"
                    onClick={() => setShowInput(s => !s)}
                    className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                >
                    + Add at current time
                </button>
            </div>

            <AnimatePresence>
                {showInput && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-3"
                    >
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={labelInput}
                                onChange={e => setLabelInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                placeholder="Bookmark label (optional)"
                                className="input-field flex-1 text-sm px-3 py-2"
                                autoFocus
                            />
                            <button
                                onClick={handleAdd}
                                disabled={adding}
                                className="btn-primary px-4 py-2 text-sm font-semibold"
                            >
                                {adding ? '…' : 'Save'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {bookmarks.length === 0 && (
                <p className="text-xs text-slate-600 italic">No bookmarks yet. Pause at any moment and click "+ Add".</p>
            )}

            <div className="flex flex-wrap gap-2">
                {bookmarks.map(b => (
                    <motion.div
                        key={b.id}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        className="group flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg pl-3 pr-1.5 py-1.5 cursor-pointer hover:bg-violet-500/20 hover:border-violet-500/40 transition-all duration-200"
                        onClick={() => seekTo(b.timestamp_secs)}
                        title={`Jump to ${formatDuration(b.timestamp_secs)}`}
                    >
                        <span className="text-violet-400 text-xs font-mono font-bold">
                            {formatDuration(b.timestamp_secs)}
                        </span>
                        {b.label && (
                            <span className="text-slate-300 text-xs max-w-[120px] truncate">{b.label}</span>
                        )}
                        <button
                            onClick={e => { e.stopPropagation(); handleDelete(b.id) }}
                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all ml-1"
                            title="Delete bookmark"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </motion.div>
                ))}
            </div>

            {/* Mini progress bar showing bookmark positions */}
            {bookmarks.length > 0 && videoDuration > 0 && (
                <div className="relative mt-3 h-1 bg-white/[0.04] rounded-full overflow-visible">
                    {bookmarks.map(b => (
                        <div
                            key={b.id}
                            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-400 border-2 border-[#0d0d1f] cursor-pointer hover:scale-150 transition-transform"
                            style={{ left: `${Math.min(98, (b.timestamp_secs / videoDuration) * 100)}%` }}
                            onClick={() => seekTo(b.timestamp_secs)}
                            title={`${b.label || ''} — ${formatDuration(b.timestamp_secs)}`}
                        />
                    ))}
                    <div className="h-full bg-white/[0.04] rounded-full w-full" />
                </div>
            )}
        </div>
    )
}

export default function PlayerPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const videoRef = useRef(null)
    const playerRef = useRef(null)
    const progressTimerRef = useRef(null)
    const [video, setVideo] = useState(null)
    const [siblings, setSiblings] = useState([])
    const siblingsRef = useRef([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [theatreMode, setTheatreMode] = useState(false)
    const [autoPlay, setAutoPlay] = useState(() => localStorage.getItem('phantom_autoplay') === 'true')
    const [shortcutFeedback, setShortcutFeedback] = useState(null)
    const [pipActive, setPipActive] = useState(false)
    const feedbackTimerRef = useRef(null)

    const ambientColor = useAmbientColor(video?.thumbnail_url)

    const showFeedback = useCallback((icon, text) => {
        setShortcutFeedback({ icon, text })
        clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = setTimeout(() => {
            setShortcutFeedback(null)
        }, 1200)
    }, [])

    const toggleAutoPlay = () => {
        const next = !autoPlay
        setAutoPlay(next)
        localStorage.setItem('phantom_autoplay', String(next))
    }

    // PiP toggle
    const togglePip = useCallback(async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture()
                setPipActive(false)
            } else if (videoRef.current) {
                await videoRef.current.requestPictureInPicture()
                setPipActive(true)
            }
        } catch (err) {
            console.warn('PiP not supported or failed:', err)
        }
    }, [])

    // Track PiP exit from browser chrome
    useEffect(() => {
        const onExit = () => setPipActive(false)
        document.addEventListener('leavepictureinpicture', onExit)
        return () => document.removeEventListener('leavepictureinpicture', onExit)
    }, [])

    const getActualTime = useCallback((currentTime) => {
        return currentTime || 0
    }, [])

    // Save progress
    const saveProgress = useCallback((currentTime) => {
        if (!id || currentTime === undefined) return
        const actualTime = getActualTime(currentTime)
        if (actualTime < 5) return
        updateProgress(id, actualTime).catch(() => { })
    }, [id, getActualTime])

    // Fetch metadata
    useEffect(() => {
        setLoading(true)
        setError(null)
        getVideo(id)
            .then(v => {
                setVideo(v)
                // Fetch sibling videos from same category
                return getVideos('date_added').then(all => {
                    const cat = v.category || 'Uncategorized'
                    const categoryVideos = all.filter(s => s.category === cat)
                    // Sort alphabetically by filename
                    categoryVideos.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }))
                    const currentIndex = categoryVideos.findIndex(s => s.id === v.id)
                    const nextVideos = currentIndex >= 0 ? categoryVideos.slice(currentIndex + 1) : []
                    setSiblings(nextVideos)
                    siblingsRef.current = nextVideos
                })
            })
            .catch(() => setError('Video not found'))
            .finally(() => setLoading(false))
    }, [id])

    // Init Plyr
    useEffect(() => {
        if (!video || !videoRef.current) return

        if (playerRef.current) {
            try { playerRef.current.destroy() } catch { }
        }

        const savedSpeed = parseFloat(localStorage.getItem(SPEED_KEY)) || 1
        const savedVolume = parseFloat(localStorage.getItem(VOLUME_KEY))
        const savedMuted = localStorage.getItem(MUTED_KEY) === 'true'

        const options = {
            controls: [
                'play-large', 'rewind', 'play', 'fast-forward', 'progress',
                'current-time', 'duration', 'mute', 'volume',
                'captions', 'settings', 'pip', 'airplay', 'fullscreen',
            ],
            settings: ['captions', 'quality', 'speed', 'loop'],
            speed: { selected: savedSpeed, options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3] },
            keyboard: { focused: true, global: true },
            tooltips: { controls: true, seek: true },
        }

        let plyr
        let hls

        const isHls = video.filename.toLowerCase().endsWith('.mkv') || video.filename.toLowerCase().endsWith('.avi')
        const targetTime = video.watch_progress_secs || 0

        if (isHls && Hls.isSupported()) {
            const hlsConfig = targetTime > 10 ? { startPosition: targetTime } : {}
            hls = new Hls(hlsConfig)
            hls.loadSource(getHlsUrl(id))
            hls.attachMedia(videoRef.current)
            plyr = new Plyr(videoRef.current, options)
        } else {
            videoRef.current.src = getStreamUrl(id)
            plyr = new Plyr(videoRef.current, options)

            if (targetTime > 10) {
                videoRef.current.addEventListener('loadedmetadata', () => {
                    videoRef.current.currentTime = targetTime
                }, { once: true })
            }
        }

        // Restore saved speed after ready
        plyr.on('ready', () => {
            if (savedSpeed !== 1) {
                try { plyr.speed = savedSpeed } catch { }
            }
            // ── Volume Memory: restore saved volume/mute ──
            try {
                if (!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
                    plyr.volume = savedVolume
                }
                if (savedMuted) {
                    plyr.muted = true
                }
            } catch { }
        })

        // Save speed on change
        plyr.on('ratechange', () => {
            try {
                const spd = plyr.speed
                if (spd) localStorage.setItem(SPEED_KEY, String(spd))
            } catch { }
        })

        // ── Volume Memory: persist volume/mute changes ──
        plyr.on('volumechange', () => {
            try {
                localStorage.setItem(VOLUME_KEY, String(plyr.volume))
                localStorage.setItem(MUTED_KEY, String(plyr.muted))
                if (plyr.muted) {
                    showFeedback('🔇', 'Muted')
                } else {
                    showFeedback('🔊', `${Math.round(plyr.volume * 100)}%`)
                }
            } catch { }
        })

        // Save progress every 10s during playback
        plyr.on('timeupdate', () => {
            clearTimeout(progressTimerRef.current)
            progressTimerRef.current = setTimeout(() => {
                saveProgress(plyr.currentTime)
            }, 10000)
        })

        // Save on pause
        plyr.on('pause', () => {
            saveProgress(plyr.currentTime)
            showFeedback('⏸️', 'Paused')
        })

        plyr.on('play', () => {
            showFeedback('▶️', 'Playing')
        })

        plyr.on('seeked', () => {
            showFeedback('⏩', formatDuration(plyr.currentTime))
        })

        // Auto play next on ended
        plyr.on('ended', () => {
            if (localStorage.getItem('phantom_autoplay') === 'true') {
                const nextSibs = siblingsRef.current
                if (nextSibs && nextSibs.length > 0) {
                    setTimeout(() => {
                        navigate(`/player/${nextSibs[0].id}`)
                    }, 1000)
                }
            }
        })

        playerRef.current = plyr

        // Double tap to seek for touch devices
        plyr.on('ready', () => {
            const container = plyr.elements.container
            if (container) {
                let lastTapTime = 0
                container.addEventListener('touchend', (e) => {
                    const now = Date.now()
                    const timeDiff = now - lastTapTime
                    if (timeDiff < 300 && timeDiff > 0) {
                        const rect = container.getBoundingClientRect()
                        const touch = e.changedTouches[0]
                        const x = touch.clientX - rect.left
                        if (x < rect.width / 2) {
                            plyr.rewind(10)
                        } else {
                            plyr.forward(10)
                        }
                        e.preventDefault()
                    }
                    lastTapTime = now
                })
            }
        })

        return () => {
            if (playerRef.current) {
                try {
                    saveProgress(playerRef.current.currentTime)
                    playerRef.current.destroy()
                } catch { }
                playerRef.current = null
            }
            if (hls) {
                hls.destroy()
            }
            clearTimeout(progressTimerRef.current)
            clearTimeout(feedbackTimerRef.current)
        }
    }, [video, saveProgress, showFeedback])

    // Play Next — next in siblings list
    const handlePlayNext = useCallback(() => {
        if (siblings.length === 0) return
        navigate(`/player/${siblings[0].id}`)
    }, [siblings, navigate])

    // Shuffle — random sibling
    const handleShuffle = useCallback(() => {
        if (siblings.length === 0) return
        const idx = Math.floor(Math.random() * siblings.length)
        navigate(`/player/${siblings[idx].id}`)
    }, [siblings, navigate])

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--c-bg)' }}>
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <svg className="animate-spin w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                </div>
                <span className="text-slate-400 text-sm">Loading video…</span>
            </div>
        </div>
    )

    if (error) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--c-bg)' }}>
            <div className="text-center">
                <div className="text-5xl mb-4">⚠️</div>
                <p className="text-red-400 text-lg font-semibold mb-6">{error}</p>
                <button onClick={() => navigate('/')}
                    className="btn-primary px-6 py-3 text-sm font-semibold">
                    ← Back to Library
                </button>
            </div>
        </div>
    )

    const name = video.filename.replace(/\.[^/.]+$/, '')
    const progressPercent = video.duration && video.watch_progress_secs
        ? Math.min(100, (video.watch_progress_secs / video.duration) * 100)
        : 0

    return (
        <div className="min-h-screen relative" style={{ background: 'var(--c-bg)' }}>
            {/* Theatre Mode overlay */}
            <div className={`theatre-mode-bg ${theatreMode ? 'active' : ''}`} />

            {/* Background orb */}
            <div className="orb w-96 h-96 bg-violet-700 -top-10 left-1/4" />

            {/* Top Bar */}
            <header className="glass border-b border-violet-500/10 px-4 sm:px-6 py-3 flex items-center gap-3 relative z-20">
                <button
                    id="back-btn"
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors group"
                >
                    <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="hidden sm:inline">Library</span>
                </button>
                <div className="w-px h-5 bg-white/10" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-violet-400 font-bold uppercase shrink-0">▶</span>
                    <h1 className="text-sm font-semibold text-slate-200 truncate">{name}</h1>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Sleep Timer */}
                    <SleepTimer playerRef={playerRef} />

                    {/* Theatre Mode */}
                    <button
                        id="theatre-mode-btn"
                        onClick={() => setTheatreMode(t => !t)}
                        className={`action-chip ${theatreMode ? 'theatre-active' : ''}`}
                        title="Toggle Theatre Mode"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
                        </svg>
                        <span className="hidden sm:inline">Theatre</span>
                    </button>

                    {/* Picture-in-Picture */}
                    {document.pictureInPictureEnabled && (
                        <button
                            id="pip-btn"
                            onClick={togglePip}
                            title="Picture-in-Picture"
                            className={`action-chip ${pipActive ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : ''}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                                <rect x="10" y="11" width="9" height="6" rx="1" strokeWidth={2} />
                            </svg>
                            <span className="hidden sm:inline">PiP</span>
                        </button>
                    )}

                    <a
                        id="download-video-btn"
                        href={getDownloadUrl(id)}
                        download={video.filename}
                        className="btn-ghost flex items-center gap-2 px-3 py-2 text-sm font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5 5-5M12 4v11" />
                        </svg>
                        <span className="hidden sm:inline">Download</span>
                    </a>
                </div>
            </header>

            {/* Player */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-fade-in relative z-10">
                {/* Ambient glow behind player */}
                <div className="relative">
                    {theatreMode && (
                        <div
                            className="ambient-glow active"
                            style={{ background: `rgb(${ambientColor})`, transition: 'opacity 0.8s ease' }}
                        />
                    )}
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-violet-900/40 ring-1 ring-violet-500/10">
                        <video
                            ref={videoRef}
                            id={`player-${id}`}
                            className="w-full"
                            playsInline
                            preload="auto"
                        />
                        <AnimatePresence>
                            {shortcutFeedback && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.2 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] pointer-events-none flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-2xl p-6 min-w-[120px] border border-white/10 shadow-2xl"
                                >
                                    <span className="text-4xl mb-2">{shortcutFeedback.icon}</span>
                                    <span className="text-white font-bold tracking-wider">{shortcutFeedback.text}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Progress completion bar */}
                {progressPercent > 0 && (
                    <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all"
                                style={{ width: `${progressPercent}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">
                            {formatDuration(video.watch_progress_secs)} / {formatDuration(video.duration)}
                        </span>
                    </div>
                )}

                {/* Metadata */}
                <div className="mt-5 glass rounded-2xl p-5 animate-slide-up">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-white font-['Space_Grotesk']">{name}</h2>
                            <p className="text-xs text-slate-600 font-mono mt-1 truncate max-w-xl">{video.path}</p>
                        </div>
                        <span className="bg-violet-500/10 text-violet-400 border border-violet-500/20
                            rounded-lg px-3 py-1 text-xs font-bold uppercase shrink-0">
                            {video.category}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-5">
                        <MetaBadge icon="⏱">
                            {formatDuration(video.duration)}
                        </MetaBadge>
                        <MetaBadge icon="💾">
                            {formatSize(video.size)}
                        </MetaBadge>
                        <MetaBadge icon="📅">
                            {new Date(video.date_added).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </MetaBadge>
                        <MetaBadge icon="🎞">
                            {video.filename.split('.').pop().toUpperCase()}
                        </MetaBadge>
                        {video.resolution && (
                            <MetaBadge icon="📐">
                                {video.resolution}
                            </MetaBadge>
                        )}
                        {video.last_watched_at && (
                            <MetaBadge icon="👁">
                                Watched {new Date(video.last_watched_at).toLocaleDateString()}
                            </MetaBadge>
                        )}
                    </div>

                    {/* Play Next / Shuffle */}
                    {siblings.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mb-5">
                            <button
                                id="play-next-btn"
                                onClick={handlePlayNext}
                                className="action-chip"
                                title={`Play next: ${siblings[0]?.filename.replace(/\.[^/.]+$/, '')}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M9 5l7 7-7 7M20 5v14" />
                                </svg>
                                Play Next
                            </button>
                            <button
                                id="shuffle-btn"
                                onClick={handleShuffle}
                                className="action-chip"
                                title="Shuffle — play a random video from this category"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M4 16v-2.5a4 4 0 014-4h8M4 8v2.5a4 4 0 004 4h8m0-8l3 3-3 3m0 6l3 3-3 3" />
                                </svg>
                                Shuffle
                            </button>

                            <div className="w-px h-6 bg-white/[0.06] mx-1" />
                            
                            <label className="flex items-center gap-2 cursor-pointer group px-2 py-1">
                                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${autoPlay ? 'bg-violet-500' : 'bg-slate-700'}`}>
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300`} style={{ transform: autoPlay ? 'translateX(18px)' : 'translateX(4px)' }} />
                                </div>
                                <span className="text-sm font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
                                    Auto-Play Next
                                </span>
                                <input type="checkbox" className="hidden" checked={autoPlay} onChange={toggleAutoPlay} />
                            </label>

                            <span className="text-xs text-slate-600 ml-auto self-center">
                                {siblings.length} more in {video.category}
                            </span>
                        </div>
                    )}

                    {/* Bookmarks Panel */}
                    <BookmarksPanel
                        videoId={parseInt(id)}
                        playerRef={playerRef}
                        videoDuration={video.duration || 0}
                    />

                    {/* Keyboard shortcuts */}
                    <div className="border-t border-white/[0.05] pt-4 mt-4">
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-3">Keyboard Shortcuts</p>
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {SHORTCUTS.map(s => (
                                <span key={s.key} className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <kbd className="bg-white/[0.06] border border-white/[0.10] text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-mono">
                                        {s.key}
                                    </kbd>
                                    {s.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
