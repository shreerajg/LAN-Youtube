import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastCtx = createContext(null)

const ICONS = {
    success: (
        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    ),
    error: (
        <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    info: (
        <svg className="w-5 h-5 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
        </svg>
    ),
    loading: (
        <svg className="w-5 h-5 text-violet-400 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
    ),
}

const BG = {
    success: 'from-emerald-900/40 to-emerald-950/20 border-emerald-500/20',
    error: 'from-red-900/40 to-red-950/20 border-red-500/20',
    info: 'from-violet-900/40 to-violet-950/20 border-violet-500/20',
    loading: 'from-violet-900/40 to-violet-950/20 border-violet-500/20',
}

function ToastItem({ toast, onRemove }) {
    const [exiting, setExiting] = React.useState(false)

    const dismiss = () => {
        setExiting(true)
        setTimeout(() => onRemove(toast.id), 260)
    }

    React.useEffect(() => {
        if (toast.type === 'loading') return
        const t = setTimeout(dismiss, toast.duration || 3500)
        return () => clearTimeout(t)
    }, [toast])

    return (
        <div className={`toast-${exiting ? 'exit' : 'enter'} flex items-start gap-3 px-4 py-3.5 rounded-2xl
            glass border bg-gradient-to-br ${BG[toast.type] || BG.info}
            shadow-2xl shadow-black/40 max-w-sm w-full pointer-events-auto`}>
            {ICONS[toast.type] || ICONS.info}
            <p className="text-sm text-slate-200 flex-1 leading-snug">{toast.message}</p>
            {toast.type !== 'loading' && (
                <button onClick={dismiss} className="text-slate-500 hover:text-white transition-colors shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    )
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])
    const counter = useRef(0)

    const add = useCallback((message, type = 'info', duration) => {
        const id = ++counter.current
        setToasts(t => [...t, { id, message, type, duration }])
        return id
    }, [])

    const remove = useCallback(id => {
        setToasts(t => t.filter(x => x.id !== id))
    }, [])

    const update = useCallback((id, message, type) => {
        setToasts(t => t.map(x => x.id === id ? { ...x, message, type } : x))
        // Auto-remove after 3s when updated away from loading
        if (type !== 'loading') {
            setTimeout(() => remove(id), 3500)
        }
    }, [remove])

    return (
        <ToastCtx.Provider value={{ add, remove, update }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 items-end pointer-events-none">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onRemove={remove} />
                ))}
            </div>
        </ToastCtx.Provider>
    )
}

export function useToast() {
    return useContext(ToastCtx)
}
