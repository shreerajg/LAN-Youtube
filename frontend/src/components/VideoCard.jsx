import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toggleFavorite } from '../api'

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

// Derive resolution label and CSS class
function getResBadge(resolution) {
    if (!resolution) return null
    const parts = resolution.split('x')
    if (parts.length !== 2) return null
    const h = parseInt(parts[1], 10)
    if (h >= 2160) return { label: '4K', cls: 'res-badge-4k' }
    if (h >= 1080) return { label: '1080p', cls: 'res-badge-1080' }
    if (h >= 720) return { label: '720p', cls: 'res-badge-720' }
    return { label: `${h}p`, cls: 'res-badge-other' }
}

// "NEW" badge — within 48 hours of date_added
function isNew(video) {
    if (!video.date_added) return false
    const added = new Date(video.date_added)
    const now = new Date()
    return (now - added) < 48 * 60 * 60 * 1000
}

// ── Grid Card (default) ───────────────────────────────────────────────────────
export default function VideoCard({ video, style, onAddToPlaylist, onFavoriteToggle }) {
    const navigate = useNavigate()
    const name = video.filename.replace(/\.[^/.]+$/, '')
    const progress = progressPercent(video)
    const hasProgress = progress > 1
    const [imgLoaded, setImgLoaded] = useState(false)
    const [isFav, setIsFav] = useState(video.is_favorite || false)
    const [heartAnim, setHeartAnim] = useState(false)
    const resBadge = getResBadge(video.resolution)
    const showNew = isNew(video)

    const handleFavClick = useCallback(async (e) => {
        e.stopPropagation()
        try {
            const res = await toggleFavorite(video.id)
            setIsFav(res.is_favorite)
            setHeartAnim(true)
            setTimeout(() => setHeartAnim(false), 420)
            onFavoriteToggle && onFavoriteToggle()
        } catch { /* silent */ }
    }, [video.id, onFavoriteToggle])

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

                {/* NEW badge */}
                {showNew && (
                    <span className="absolute top-8 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black
                        px-1.5 py-0.5 rounded-md uppercase tracking-wide new-badge-pulse z-10">
                        NEW
                    </span>
                )}

                {/* Resolution badge */}
                {resBadge && (
                    <span className={`absolute bottom-7 left-2 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide z-10 ${resBadge.cls}`}>
                        {resBadge.label}
                    </span>
                )}

                {/* Favorite heart button */}
                <button
                    onClick={handleFavClick}
                    className={`absolute bottom-7 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all z-10
                        opacity-0 group-hover:opacity-100 backdrop-blur-sm
                        ${isFav
                            ? 'opacity-100 bg-red-500/80 hover:bg-red-500 text-white'
                            : 'bg-black/60 hover:bg-red-500/70 text-slate-300 hover:text-white'
                        } ${heartAnim ? 'heart-pop' : ''}`}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <svg className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </button>

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
                    {isFav && <span className="ml-auto text-red-400 text-xs">♥</span>}
                </div>
            </div>
        </article>
    )
}

// ── List Card ────────────────────────────────────────────────────────────────
export function VideoListCard({ video, style, onFavoriteToggle }) {
    const navigate = useNavigate()
    const name = video.filename.replace(/\.[^/.]+$/, '')
    const progress = progressPercent(video)
    const hasProgress = progress > 1
    const [isFav, setIsFav] = useState(video.is_favorite || false)
    const [heartAnim, setHeartAnim] = useState(false)
    const resBadge = getResBadge(video.resolution)
    const showNew = isNew(video)

    const handleFavClick = useCallback(async (e) => {
        e.stopPropagation()
        try {
            const res = await toggleFavorite(video.id)
            setIsFav(res.is_favorite)
            setHeartAnim(true)
            setTimeout(() => setHeartAnim(false), 420)
            onFavoriteToggle && onFavoriteToggle()
        } catch { /* silent */ }
    }, [video.id, onFavoriteToggle])

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
                {showNew && (
                    <span className="absolute top-1 left-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-black
                        px-1 py-0.5 rounded uppercase tracking-wide new-badge-pulse">NEW</span>
                )}
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
                    {resBadge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide ${resBadge.cls}`}>
                            {resBadge.label}
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-slate-600 font-mono truncate mt-1 hidden sm:block">
                    {video.path}
                </p>
            </div>

            {/* Fav + arrow */}
            <div className="shrink-0 flex items-center gap-2">
                <button
                    onClick={handleFavClick}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
                        ${isFav
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
                        } ${heartAnim ? 'heart-pop' : ''}`}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </button>
                <div className="text-slate-600 group-hover:text-violet-400 transition-colors group-hover:translate-x-1 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
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
