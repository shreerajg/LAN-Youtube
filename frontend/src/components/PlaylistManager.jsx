import React, { useState, useEffect } from 'react'
import { getPlaylists, createPlaylist, deletePlaylist, addVideoToPlaylist, removeVideoFromPlaylist } from '../api'

export default function PlaylistManager({ videoId, onClose }) {
    const [playlists, setPlaylists] = useState([])
    const [loading, setLoading] = useState(true)
    const [newName, setNewName] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState(null)
    const [addingId, setAddingId] = useState(null)

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-[#0f0f1a] border border-violet-500/20 rounded-2xl shadow-2xl shadow-violet-900/30 overflow-hidden animate-scale-in">
                <div className="p-5 border-b border-white/[0.06]">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="text-violet-400">📋</span> Playlists
                        </h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-5 max-h-[60vh] overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

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
                            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
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
                                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-violet-500/30 transition-colors group">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600/30 to-cyan-600/30 flex items-center justify-center text-xl">
                                        🎵
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-semibold truncate">{p.name}</p>
                                        <p className="text-xs text-slate-500">{p.item_count} videos</p>
                                    </div>
                                    <button
                                        onClick={() => handleAddToPlaylist(p.id)}
                                        disabled={addingId === p.id}
                                        className="px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-400 text-sm font-medium hover:bg-violet-600/40 transition-colors disabled:opacity-50"
                                    >
                                        {addingId === p.id ? '...' : '+ Add'}
                                    </button>
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
                </div>
            </div>
        </div>
    )
}