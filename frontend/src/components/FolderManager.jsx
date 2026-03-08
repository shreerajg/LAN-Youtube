import React, { useState, useEffect, useRef } from 'react'
import { getFolders, addFolder, deleteFolder, getStats } from '../api'
import { useToast } from './Toast'

function FolderIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 7a2 2 0 012-2h4.586a1 1 0 01.707.293L12 7h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
    )
}

export default function FolderManager({ onClose, onScanComplete }) {
    const [folders, setFolders] = useState([])
    const [input, setInput] = useState('')
    const [adding, setAdding] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [removing, setRemoving] = useState(null)
    const toast = useToast()
    const pollRef = useRef(null)

    useEffect(() => {
        getFolders().then(setFolders).catch(() => { })
    }, [])

    // Poll stats until video count changes after adding a folder
    const pollUntilChanged = (prevCount) => {
        setScanning(true)
        let attempts = 0
        const max = 20 // up to 20 × 1.5s = 30s
        pollRef.current = setInterval(async () => {
            attempts++
            try {
                const s = await getStats()
                if (s.total_videos !== prevCount || attempts >= max) {
                    clearInterval(pollRef.current)
                    setScanning(false)
                    onScanComplete && onScanComplete()
                }
            } catch {
                if (attempts >= max) {
                    clearInterval(pollRef.current)
                    setScanning(false)
                }
            }
        }, 1500)
    }

    useEffect(() => () => clearInterval(pollRef.current), [])

    const handleAdd = async () => {
        if (!input.trim()) return
        setAdding(true)
        const tid = toast.add('Adding folder…', 'loading')
        try {
            const prevStats = await getStats().catch(() => ({ total_videos: 0 }))
            await addFolder(input.trim())
            const updated = await getFolders()
            setFolders(updated)
            setInput('')
            toast.update(tid, 'Folder added! Scanning for videos…', 'success')
            pollUntilChanged(prevStats.total_videos)
        } catch (e) {
            toast.update(tid, e.message || 'Could not add folder', 'error')
        } finally {
            setAdding(false)
        }
    }

    const handleRemove = async (id, label) => {
        setRemoving(id)
        const tid = toast.add(`Removing "${label}"…`, 'loading')
        try {
            await deleteFolder(id)
            setFolders(f => f.filter(x => x.id !== id))
            toast.update(tid, 'Folder removed', 'success')
            onScanComplete && onScanComplete()
        } catch {
            toast.update(tid, 'Failed to remove folder', 'error')
        } finally {
            setRemoving(null)
        }
    }

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-panel glass rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg mx-0 sm:mx-4 overflow-hidden border border-violet-500/20">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400">
                            <FolderIcon />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white font-['Space_Grotesk']">Watched Folders</h2>
                            <p className="text-xs text-slate-500">Stream from any drive or path — no copying needed</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-lg btn-ghost flex items-center justify-center text-slate-400 hover:text-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Add folder input */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wider">
                            Add a Folder Path
                        </label>
                        <div className="flex gap-2">
                            <input
                                id="folder-path-input"
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !adding && handleAdd()}
                                placeholder="D:\Movies  or  E:\Series\Action"
                                className="input-field flex-1 px-4 py-3 text-sm font-mono"
                            />
                            <button
                                id="add-folder-btn"
                                onClick={handleAdd}
                                disabled={adding || !input.trim()}
                                className="btn-primary px-4 py-3 text-sm font-semibold disabled:opacity-40 shrink-0"
                            >
                                {adding ? (
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1.5">
                            Paste any absolute path. Videos stream from their original location.
                        </p>
                    </div>

                    {/* Scan indicator */}
                    {scanning && (
                        <div className="relative overflow-hidden rounded-xl bg-violet-500/5 border border-violet-500/15 px-4 py-3 flex items-center gap-3">
                            <div className="scan-bar rounded-full" />
                            <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 scan-pulse z-10">
                                <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                                </svg>
                            </div>
                            <p className="text-xs text-violet-300 z-10">Scanning folder for videos… Library will update automatically</p>
                        </div>
                    )}

                    {/* Folder list */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wider">
                            Watched Folders ({folders.length})
                        </label>
                        {folders.length === 0 ? (
                            <div className="text-center py-8 text-slate-600 text-sm">
                                <div className="text-3xl mb-2">📂</div>
                                No folders yet. Add one above!
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {folders.map(f => (
                                    <div key={f.id}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] group">
                                        <div className="text-violet-500/50 shrink-0"><FolderIcon /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-200 truncate">{f.label || 'Folder'}</p>
                                            <p className="text-[11px] text-slate-500 font-mono truncate">{f.path}</p>
                                        </div>
                                        <button
                                            onClick={() => handleRemove(f.id, f.label || f.path)}
                                            disabled={removing === f.id}
                                            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-600
                                                hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
                                            {removing === f.id ? (
                                                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 pb-6">
                    <button onClick={onClose} className="w-full btn-ghost py-3 text-sm font-semibold text-slate-400">
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
