import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useTransition, animated } from 'react-spring'
import HomePage from './pages/HomePage'
import PlayerPage from './pages/PlayerPage'
import { ToastProvider } from './components/Toast'

function PageWrapper({ children }) {
    return (
        <animated.div
            className="page-wrapper"
            style={{
                animation: 'pageIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
        >
            {children}
        </animated.div>
    )
}

function SystemStatusFooter() {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
            <div className="border-t border-cyan-500/30 bg-black/40 backdrop-blur-md px-4 py-1.5 flex items-center justify-between text-[10px] sm:text-xs">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                    <span className="font-mono text-cyan-400 font-semibold tracking-widest uppercase">
                        [SYS_AUTH]: DEV_SHREERAJ_GUDADE // STACK_ACTIVE
                    </span>
                </div>
                <div className="hidden sm:flex font-mono text-violet-400 font-semibold tracking-widest uppercase opacity-70">
                    PHANTOM CORE ENGINE v1.0.4
                </div>
            </div>
        </div>
    )
}

export default function App() {
    return (
        <ToastProvider>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/player/:id" element={<PlayerPage />} />
                <Route path="*" element={<HomePage />} />
            </Routes>
            <SystemStatusFooter />
        </ToastProvider>
    )
}
