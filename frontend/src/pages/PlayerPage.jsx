import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Plyr from 'plyr'
import { getVideo, getStreamUrl, getDownloadUrl, updateProgress, getHlsUrl } from '../api'
import Hls from 'hls.js'

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

export default function PlayerPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const videoRef = useRef(null)
    const playerRef = useRef(null)
    const progressTimerRef = useRef(null)
    const [video, setVideo] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

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
            .then(setVideo)
            .catch(() => setError('Video not found'))
            .finally(() => setLoading(false))
    }, [id])

    // Init Plyr
    useEffect(() => {
        if (!video || !videoRef.current) return

        if (playerRef.current) {
            try { playerRef.current.destroy() } catch { }
        }

        const options = {
            controls: [
                'play-large', 'rewind', 'play', 'fast-forward', 'progress',
                'current-time', 'duration', 'mute', 'volume',
                'captions', 'settings', 'pip', 'airplay', 'fullscreen',
            ],
            settings: ['captions', 'quality', 'speed', 'loop'],
            speed: { selected: 1, options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3] },
            keyboard: { focused: true, global: true },
            tooltips: { controls: true, seek: true },
        }

        let plyr;
        let hls;

        const isHls = video.filename.toLowerCase().endsWith('.mkv') || video.filename.toLowerCase().endsWith('.avi');

        const targetTime = video.watch_progress_secs || 0;

        if (isHls && Hls.isSupported()) {
            const hlsConfig = targetTime > 10 ? { startPosition: targetTime } : {};
            hls = new Hls(hlsConfig);
            hls.loadSource(getHlsUrl(id));
            hls.attachMedia(videoRef.current);
            plyr = new Plyr(videoRef.current, options);
        } else {
            videoRef.current.src = getStreamUrl(id)
            plyr = new Plyr(videoRef.current, options)

            if (targetTime > 10) {
                videoRef.current.addEventListener('loadedmetadata', () => {
                    videoRef.current.currentTime = targetTime;
                }, { once: true });
            }
        }

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
                hls.destroy();
            }
            clearTimeout(progressTimerRef.current)
        }
    }, [video, saveProgress])

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
        <div className="min-h-screen" style={{ background: 'var(--c-bg)' }}>
            {/* Background orb */}
            <div className="orb w-96 h-96 bg-violet-700 -top-10 left-1/4" />

            {/* Top Bar */}
            <header className="glass border-b border-violet-500/10 px-4 sm:px-6 py-3 flex items-center gap-3 relative z-10">
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
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-violet-900/40 ring-1 ring-violet-500/10">
                    <video
                        ref={videoRef}
                        id={`player-${id}`}
                        className="w-full"
                        playsInline
                        preload="auto"
                    />
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
                        {video.last_watched_at && (
                            <MetaBadge icon="👁">
                                Watched {new Date(video.last_watched_at).toLocaleDateString()}
                            </MetaBadge>
                        )}
                    </div>

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
