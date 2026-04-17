import React from 'react'
import { useNavigate } from 'react-router-dom'

function formatDuration(secs) {
    if (!secs) return '0:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
}

function formatSize(bytes) {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
    return (bytes / 1e3).toFixed(0) + ' KB'
}

function progressPercent(video) {
    if (!video.duration || !video.watch_progress_secs) return 0
    return Math.min(100, (video.watch_progress_secs / video.duration) * 100)
}

function formatProgress(secs) {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${String(s).padStart(2, '0')}`
}

// ── Grid Card (default) ───────────────────────────────────────────────────────
export default function VideoCard({ video, style, onAddToPlaylist }) {
    const navigate = useNavigate()
    const name = video.filename.replace(/\.[^/.]+$/, '')
    const progress = progressPercent(video)
    const hasProgress = progress > 1
    const [imgLoaded, setImgLoaded] = React.useState(false)

    const handleAddClick = (e) => {
        e.stopPropagation()
        onAddToPlaylist && onAddToPlaylist(video)
    }

    return (
        <article
            id={`video-card-${video.id}`}
            className="video-card animate-fade-in"
            style={style}
            onClick={() => navigate(`/player/${video.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate(`/player/${video.id}`)}
            aria-label={`Play ${name}`}
        >
            {/* Thumbnail */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <img
                    src={video.thumbnail_url}
                    alt={name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
                    style={{ transform: imgLoaded ? 'scale(1)' : 'scale(1.1)', opacity: imgLoaded ? 1 : 0 }}
                    onLoad={() => setImgLoaded(true)}
                    onError={e => { e.target.src = ''; setImgLoaded(true) }}
                />

                {/* Overlay */}
                <div className="card-overlay absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-violet-500 flex items-center justify-center
                        shadow-2xl shadow-violet-600/60 backdrop-blur-sm
                        transform scale-90 group-hover:scale-100 transition-all duration-300 ring-2 ring-white/20">
                        <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                    {hasProgress && (
                        <span className="text-xs text-white/90 bg-black/60 rounded-full px-3 py-1 backdrop-blur-sm font-medium shadow-lg">
                            Resume {formatProgress(video.watch_progress_secs)}
                        </span>
                    )}
                </div>

                {/* Duration badge */}
                <span className="absolute top-2 right-2 bg-black/70 text-white text-[11px] font-mono px-2 py-0.5 rounded-md
                    backdrop-blur-sm border border-white/10">
                    {formatDuration(video.duration)}
                </span>

                {/* File extension badge */}
                <span className="absolute top-2 left-2 bg-violet-600/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md
                    backdrop-blur-sm uppercase">
                    {video.filename.split('.').pop()}
                </span>

                {/* Add to playlist button */}
                {onAddToPlaylist && (
                    <button
                        onClick={handleAddClick}
                        className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-black/60 hover:bg-violet-600 text-white
                            flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                        title="Add to playlist"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                )}

                {/* Progress bar */}
                {hasProgress && (
                    <div className="watch-progress-bar" style={{ width: `${progress}%` }} />
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                <h3 className="text-sm font-semibold text-slate-200 line-clamp-2 leading-snug
                    group-hover:text-violet-300 transition-colors">
                    {name}
                </h3>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                    <span className="bg-violet-500/10 text-violet-400 rounded-md px-1.5 py-0.5 border border-violet-500/15 font-medium text-[10px]">
                        {video.category}
                    </span>
                    <span>·</span>
                    <span>{formatSize(video.size)}</span>
                </div>
            </div>
        </article>
    )
}

// ── List Card ────────────────────────────────────────────────────────────────
export function VideoListCard({ video, style }) {
    const navigate = useNavigate()
    const name = video.filename.replace(/\.[^/.]+$/, '')
    const progress = progressPercent(video)
    const hasProgress = progress > 1

    return (
        <article
            id={`video-list-${video.id}`}
            className="list-card group"
            style={style}
            onClick={() => navigate(`/player/${video.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate(`/player/${video.id}`)}
        >
            {/* Thumbnail */}
            <div className="relative w-28 sm:w-36 shrink-0 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img src={video.thumbnail_url} alt={name} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                {hasProgress && (
                    <div className="watch-progress-bar" style={{ width: `${progress}%` }} />
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-200 truncate group-hover:text-violet-300 transition-colors">
                    {name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                    <span className="bg-violet-500/10 text-violet-400 rounded px-1.5 py-0.5 border border-violet-500/15 font-medium">
                        {video.category}
                    </span>
                    <span>{formatDuration(video.duration)}</span>
                    <span>·</span>
                    <span>{formatSize(video.size)}</span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono truncate mt-1 hidden sm:block">
                    {video.path}
                </p>
            </div>

            {/* Play arrow */}
            <div className="shrink-0 text-slate-600 group-hover:text-violet-400 transition-colors group-hover:translate-x-1 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </article>
    )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function VideoCardSkeleton() {
    return (
        <div className="rounded-2xl overflow-hidden bg-surface-800 border border-white/[0.03]">
            <div className="skeleton w-full" style={{ paddingBottom: '56.25%' }} />
            <div className="p-3 space-y-2">
                <div className="skeleton h-4 w-4/5" />
                <div className="skeleton h-3 w-2/5" />
            </div>
        </div>
    )
}
