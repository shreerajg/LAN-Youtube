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

// Playlists
export const getPlaylists = () =>
    fetch(`${BASE}/api/playlists`).then(r => r.json())

export const getPlaylist = id =>
    fetch(`${BASE}/api/playlists/${id}`).then(r => r.json())

export const createPlaylist = (name, description = '') =>
    fetch(`${BASE}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
    }).then(r => r.json())

export const updatePlaylist = (id, name, description) =>
    fetch(`${BASE}/api/playlists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
    }).then(r => r.json())

export const deletePlaylist = id =>
    fetch(`${BASE}/api/playlists/${id}`, { method: 'DELETE' }).then(r => r.json())

export const addVideoToPlaylist = (playlistId, videoId) =>
    fetch(`${BASE}/api/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
    }).then(async r => {
        if (!r.ok) {
            const data = await r.json()
            throw new Error(data.detail || 'Failed to add video')
        }
        return r.json()
    })

export const removeVideoFromPlaylist = (playlistId, itemId) =>
    fetch(`${BASE}/api/playlists/${playlistId}/items/${itemId}`, { method: 'DELETE' }).then(r => r.json())

export const reorderPlaylist = (playlistId, itemIds) =>
    fetch(`${BASE}/api/playlists/${playlistId}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemIds),
    }).then(r => r.json())
