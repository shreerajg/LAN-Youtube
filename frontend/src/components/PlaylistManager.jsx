import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlaylists, createPlaylist, deletePlaylist, getPlaylist, addVideoToPlaylist } from '../api'

export default function PlaylistManager({ videoId, onClose }) {
    const [playlists, setPlaylists] = useState([])
    const [selectedPlaylist, setSelectedPlaylist] = useState(null)
    const [playlistVideos, setPlaylistVideos] = useState(null)
    const [loading, setLoading] = useState(true)
    const [newName, setNewName] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState(null)
    const [addingId, setAddingId] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        loadPlaylists()
    }, [])

    const loadPlaylists = () => {
        getPlaylists()
            .then(setPlaylists)
            .catch(() => setError('Failed to load playlists'))
            .finally(() => setLoading(false))
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!newName.trim()) return
        setCreating(true)
        try {
            await createPlaylist(newName.trim())
            setNewName('')
            loadPlaylists()
        } catch (err) {
            setError(err.message)
        } finally {
            setCreating(false)
        }
    }

    const handleAddToPlaylist = async (playlistId) => {
        if (!videoId) return
        setAddingId(playlistId)
        try {
            await addVideoToPlaylist(playlistId, videoId)
            onClose()
        } catch (err) {
            setError(err.message)
        } finally {
            setAddingId(null)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this playlist?')) return
        try {
            await deletePlaylist(id)
            loadPlaylists()
        } catch (err) {
            setError(err.message)
        }
    }

    const handlePlaylistClick = async (playlist) => {
        setSelectedPlaylist(playlist)
        try {
            const data = await getPlaylist(playlist.id)
            setPlaylistVideos(data.items || [])
        } catch (err) {
            setError('Failed to load playlist')
        }
    }

    const handleVideoClick = (videoId) => {
        navigate(`/player/${videoId}`)
        onClose()
    }

    const handleBack = () => {
        setSelectedPlaylist(null)
        setPlaylistVideos(null)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-[#0f0f1a] border border-violet-500/20 rounded-2xl shadow-2xl shadow-violet-900/30 overflow-hidden animate-scale-in max-h-[80vh] flex flex-col">
                <div className="p-5 border-b border-white/[0.06] shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {selectedPlaylist && (
                                <button onClick={handleBack} className="text-slate-400 hover:text-white transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="text-cyan-400">📋</span>
                                {selectedPlaylist ? selectedPlaylist.name : 'Playlists'}
                            </h2>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-5 flex-1 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {!selectedPlaylist ? (
                        <>
                            <form onSubmit={handleCreate} className="flex gap-2 mb-5">
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="New playlist name..."
                                    className="input-field flex-1 text-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={creating || !newName.trim()}
                                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
                                >
                                    {creating ? '...' : '+'}
                                </button>
                            </form>

                            {loading ? (
                                <div className="text-center text-slate-500 py-4">Loading...</div>
                            ) : playlists.length === 0 ? (
                                <div className="text-center text-slate-500 py-8">
                                    <div className="text-3xl mb-2">📋</div>
                                    <p>No playlists yet</p>
                                    <p className="text-sm">Create one above</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {playlists.map(p => (
                                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-cyan-500/30 transition-colors group">
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600/30 to-violet-600/30 flex items-center justify-center text-xl">
                                                🎵
                                            </div>
                                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handlePlaylistClick(p)}>
                                                <p className="text-white font-semibold truncate hover:text-cyan-400 transition-colors">{p.name}</p>
                                                <p className="text-xs text-slate-500">{p.item_count} videos</p>
                                            </div>
                                            {videoId && (
                                                <button
                                                    onClick={() => handleAddToPlaylist(p.id)}
                                                    disabled={addingId === p.id}
                                                    className="px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 text-sm font-medium hover:bg-cyan-600/40 transition-colors disabled:opacity-50"
                                                >
                                                    {addingId === p.id ? '...' : '+ Add'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div>
                            {playlistVideos && playlistVideos.length === 0 ? (
                                <div className="text-center text-slate-500 py-8">
                                    <div className="text-3xl mb-2">🎵</div>
                                    <p>Empty playlist</p>
                                    <p className="text-sm">Add videos from the grid</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {playlistVideos && playlistVideos.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleVideoClick(item.video.id)}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-cyan-500/30 transition-colors cursor-pointer group"
                                        >
                                            <img
                                                src={item.video.thumbnail_url}
                                                alt=""
                                                className="w-16 h-9 rounded object-cover"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium truncate text-sm">{item.video.filename.replace(/\.[^/.]+$/, '')}</p>
                                                <p className="text-xs text-slate-500">{item.video.category}</p>
                                            </div>
                                            <svg className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}