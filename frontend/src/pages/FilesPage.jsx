import React, { useState, useEffect, useRef } from 'react'
import { getSharedFiles, deleteSharedFile } from '../api'
import { useToast } from '../components/Toast'

export default function FilesPage() {
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(true)
    const [category, setCategory] = useState('all')
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const { addToast } = useToast()
    const fileInputRef = useRef(null)

    const fetchFiles = async () => {
        setLoading(true)
        try {
            const data = await getSharedFiles(category)
            setFiles(data)
        } catch (err) {
            console.error(err)
            addToast('Failed to load files', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchFiles()
    }, [category])

    const handleUpload = async (file) => {
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)

        setUploading(true)
        setUploadProgress(0)

        try {
            const xhr = new XMLHttpRequest()
            xhr.open('POST', '/api/files/upload', true)

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100)
                    setUploadProgress(percent)
                }
            }

            xhr.onload = () => {
                if (xhr.status === 200) {
                    addToast('File uploaded successfully', 'success')
                    fetchFiles()
                } else {
                    addToast('Upload failed', 'error')
                }
                setUploading(false)
            }

            xhr.onerror = () => {
                addToast('Upload failed', 'error')
                setUploading(false)
            }

            xhr.send(formData)
        } catch (err) {
            console.error(err)
            addToast('Upload failed', 'error')
            setUploading(false)
        }
    }

    const onFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleUpload(e.target.files[0])
            e.target.value = null // reset
        }
    }

    const onDrop = (e) => {
        e.preventDefault()
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUpload(e.dataTransfer.files[0])
        }
    }

    const onDragOver = (e) => {
        e.preventDefault()
    }

    const handleDelete = async (id, e) => {
        e.preventDefault() // prevent downloading when clicking delete
        if (!confirm('Delete this file for everyone?')) return
        try {
            await deleteSharedFile(id)
            setFiles(files.filter(f => f.id !== id))
            addToast('File deleted', 'success')
        } catch (err) {
            console.error(err)
            addToast('Failed to delete file', 'error')
        }
    }

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const getIcon = (cat) => {
        switch (cat) {
            case 'image': return '🖼️'
            case 'video': return '🎥'
            case 'audio': return '🎵'
            case 'document': return '📄'
            case 'archive': return '📦'
            case 'code': return '💻'
            default: return '📁'
        }
    }

    return (
        <div className="pt-24 pb-8 px-4 sm:px-8 max-w-7xl mx-auto min-h-screen flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-6">
                <div>
                    <h1 className="text-4xl font-black font-['Space_Grotesk'] text-white tracking-tight mb-2">
                        LAN File Share
                    </h1>
                    <p className="text-slate-400 text-sm font-medium">Upload and download files across your local network.</p>
                </div>
                
                <div className="flex gap-2 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5 overflow-x-auto hide-scrollbar w-full sm:w-auto shadow-inner backdrop-blur-md">
                    {['all', 'image', 'video', 'document', 'archive', 'other'].map(c => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                                category === c 
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                        >
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dropzone */}
            <div 
                className="mb-10 glass-card border-2 border-dashed border-indigo-500/20 rounded-3xl py-14 px-6 sm:p-12 flex flex-col items-center justify-center text-center hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden group shadow-[0_0_30px_rgba(0,0,0,0.2)]"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={() => !uploading && fileInputRef.current?.click()}
            >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-500/0 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-colors duration-700"></div>

                <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={onFileSelect} 
                />
                
                {uploading ? (
                    <div className="w-full max-w-md relative z-10">
                        <div className="flex justify-between text-sm mb-3 font-semibold tracking-wide uppercase">
                            <span className="text-indigo-400">Uploading...</span>
                            <span className="text-white">{uploadProgress}%</span>
                        </div>
                        <div className="h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6 text-4xl shadow-xl group-hover:scale-110 group-hover:-translate-y-2 transition-transform duration-500">
                            📤
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 font-['Space_Grotesk']">Click or drag files here</h3>
                        <p className="text-sm text-slate-400 font-medium">Supports any file type. No size limit.</p>
                    </div>
                )}
            </div>

            {/* Files Grid */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
            ) : files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 mt-10">
                    <div className="text-6xl mb-6 opacity-30 grayscale filter blur-[1px]">📂</div>
                    <p className="font-medium">No files found in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {files.map(file => (
                        <a
                            key={file.id}
                            href={file.download_url}
                            download={file.filename}
                            className="glass-card rounded-3xl p-5 hover:-translate-y-1 transition-all duration-300 group flex flex-col relative overflow-hidden h-[180px]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-start gap-4 mb-4 relative z-10">
                                <div className="text-4xl p-3 bg-white/[0.03] border border-white/5 rounded-2xl shadow-inner group-hover:scale-105 transition-transform">
                                    {getIcon(file.category)}
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                    <h4 className="font-bold text-white truncate text-base mb-1" title={file.filename}>
                                        {file.filename}
                                    </h4>
                                    <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md inline-block border border-indigo-500/20">
                                        {formatSize(file.size)}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto flex justify-between items-end pt-3 relative z-10">
                                <div>
                                    <div className="text-[10px] text-slate-500 font-medium mb-0.5 uppercase tracking-wide">Shared By</div>
                                    <span className="text-xs text-slate-300 font-mono" title={file.uploaded_by_ip}>
                                        {file.uploaded_by_ip}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="text-[10px] text-slate-500 font-medium mb-0.5 uppercase tracking-wide">Date</div>
                                    <span className="text-xs text-slate-400">
                                        {new Date(file.date_uploaded).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                    </span>
                                </div>
                                
                                {/* Delete button absolute in corner to not mess up alignment */}
                                <button
                                    onClick={(e) => handleDelete(file.id, e)}
                                    className="absolute bottom-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-2 bg-black/40 hover:bg-red-500/10 rounded-xl backdrop-blur-sm border border-transparent hover:border-red-500/20 z-20"
                                    title="Delete file"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    )
}
