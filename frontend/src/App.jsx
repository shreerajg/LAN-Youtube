import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import HomePage from './pages/HomePage'
import PlayerPage from './pages/PlayerPage'
import HistoryPage from './pages/HistoryPage'
import FilesPage from './pages/FilesPage'
import ChatPage from './pages/ChatPage'
import LANDashboard from './pages/LANDashboard'
import { ToastProvider } from './components/Toast'

function PageWrapper({ children }) {
    return (
        <motion.div 
            className="page-wrapper mobile-bottom-nav-padding"
            initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(0px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
            {children}
        </motion.div>
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
    const location = useLocation()
    
    return (
        <ToastProvider>
            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    <Route path="/" element={<PageWrapper><HomePage /></PageWrapper>} />
                    <Route path="/player/:id" element={<PageWrapper><PlayerPage /></PageWrapper>} />
                    <Route path="/history" element={<PageWrapper><HistoryPage /></PageWrapper>} />
                    <Route path="/files" element={<PageWrapper><FilesPage /></PageWrapper>} />
                    <Route path="/chat" element={<PageWrapper><ChatPage /></PageWrapper>} />
                    <Route path="/lan" element={<PageWrapper><LANDashboard /></PageWrapper>} />
                    <Route path="*" element={<PageWrapper><HomePage /></PageWrapper>} />
                </Routes>
            </AnimatePresence>
            <SystemStatusFooter />
        </ToastProvider>
    )
}
