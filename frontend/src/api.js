const BASE = ''

export const getVideos = (sort = 'date_added') =>
    fetch(`${BASE}/api/videos?sort=${sort}&limit=300`).then(r => r.json())

export const searchVideos = q =>
    fetch(`${BASE}/api/videos/search?q=${encodeURIComponent(q)}`).then(r => r.json())

export const getVideo = id =>
    fetch(`${BASE}/api/videos/${id}`).then(r => r.json())

export const getInProgressVideos = () =>
    fetch(`${BASE}/api/videos/in-progress`).then(r => r.json())

export const updateProgress = (id, seconds) =>
    fetch(`${BASE}/api/videos/${id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
    }).then(r => r.json())

export const getStreamUrl = id => `${BASE}/api/stream/${id}`
export const getHlsUrl = id => `${BASE}/api/hls/${id}/playlist.m3u8`
export const getDownloadUrl = id => `${BASE}/api/download/${id}`

export const getStats = () =>
    fetch(`${BASE}/api/stats`).then(r => r.json())

export const triggerScan = () =>
    fetch(`${BASE}/api/scan`, { method: 'POST' }).then(r => r.json())

// Folder management
export const getFolders = () =>
    fetch(`${BASE}/api/folders`).then(r => r.json())

export const addFolder = (path, label) =>
    fetch(`${BASE}/api/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, label }),
    }).then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.detail || 'Failed to add folder')
        return data
    })

export const deleteFolder = id =>
    fetch(`${BASE}/api/folders/${id}`, { method: 'DELETE' }).then(r => r.json())
