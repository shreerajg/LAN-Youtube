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
        <div className="pt-20 sm:pt-24 pb-6 sm:pb-8 px-4 sm:px-8 max-w-7xl mx-auto min-h-screen flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">
                        LAN File Share
                    </h1>
                    <p className="text-muted text-sm mt-2">Upload and download files across your local network.</p>
                </div>
                
                <div className="flex gap-2 bg-surface2 p-1 rounded-xl border border-border overflow-x-auto hide-scrollbar w-full sm:w-auto">
                    {['all', 'image', 'video', 'document', 'archive', 'other'].map(c => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                category === c 
                                ? 'bg-neon/20 text-neon' 
                                : 'text-muted hover:text-text hover:bg-surface'
                            }`}
                        >
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dropzone */}
            <div 
                className="mb-8 border-2 border-dashed border-border rounded-2xl py-12 px-6 sm:p-10 flex flex-col items-center justify-center text-center hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer relative overflow-hidden"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={() => !uploading && fileInputRef.current?.click()}
            >
                <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={onFileSelect} 
                />
                
                {uploading ? (
                    <div className="w-full max-w-md">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-cyan-400">Uploading...</span>
                            <span className="text-text">{uploadProgress}%</span>
                        </div>
                        <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 rounded-full bg-surface2 flex items-center justify-center mb-4 text-3xl">
                            📤
                        </div>
                        <h3 className="text-lg font-medium text-text mb-1">Click or drag files here</h3>
                        <p className="text-sm text-muted">Supports any file type. No size limit.</p>
                    </>
                )}
            </div>

            {/* Files Grid */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-surface2 border-t-neon rounded-full animate-spin"></div>
                </div>
            ) : files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted">
                    <div className="text-6xl mb-4 opacity-50">📂</div>
                    <p>No files found in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {files.map(file => (
                        <a
                            key={file.id}
                            href={file.download_url}
                            download={file.filename}
                            className="bg-surface rounded-xl p-4 border border-border hover:border-violet-500/50 transition-colors group flex flex-col"
                        >
                            <div className="flex items-start gap-4 mb-3">
                                <div className="text-4xl">
                                    {getIcon(file.category)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-text truncate" title={file.filename}>
                                        {file.filename}
                                    </h4>
                                    <div className="text-xs text-muted flex justify-between mt-1">
                                        <span>{formatSize(file.size)}</span>
                                        <span>{new Date(file.date_uploaded).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto flex justify-between items-center pt-3 border-t border-border border-dashed">
                                <span className="text-[10px] text-muted font-mono truncate mr-2" title={file.uploaded_by_ip}>
                                    From: {file.uploaded_by_ip}
                                </span>
                                <button
                                    onClick={(e) => handleDelete(file.id, e)}
                                    className="text-red-400 hover:text-red-300 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity p-3 sm:p-1 -mr-2 sm:mr-0"
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
