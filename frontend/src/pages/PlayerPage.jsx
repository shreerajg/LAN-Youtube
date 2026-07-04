import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Plyr from 'plyr'
import { getVideo, getVideos, getStreamUrl, getDownloadUrl, updateProgress, getHlsUrl } from '../api'
import Hls from 'hls.js'

const SPEED_KEY = 'phantom_playback_speed'

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

export default function PlayerPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const videoRef = useRef(null)
    const playerRef = useRef(null)
    const progressTimerRef = useRef(null)
    const [video, setVideo] = useState(null)
    const [siblings, setSiblings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [theatreMode, setTheatreMode] = useState(false)

    const ambientColor = useAmbientColor(video?.thumbnail_url)

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
                    setSiblings(all.filter(s => s.category === cat && s.id !== v.id))
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
        })

        // Save speed on change
        plyr.on('ratechange', () => {
            try {
                const spd = plyr.speed
                if (spd) localStorage.setItem(SPEED_KEY, String(spd))
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
        })

        playerRef.current = plyr

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
        }
    }, [video, saveProgress])

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
                            style={{ background: `rgb(${ambientColor})` }}
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
                        <div className="flex flex-wrap gap-2 mb-5">
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
                            <span className="text-xs text-slate-600 self-center">
                                {siblings.length} more in {video.category}
                            </span>
                        </div>
                    )}

                    {/* Keyboard shortcuts */}
                    <div className="border-t border-white/[0.05] pt-4">
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
