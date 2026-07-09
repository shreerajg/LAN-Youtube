import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const THEMES = [
    { id: 'dark', label: 'Dark', color: '#0d0d1f', border: '#8b5cf6' },
    { id: 'light', label: 'Light', color: '#ffffff', border: '#6366f1' },
    { id: 'pink', label: 'Pink', color: '#2b0f25', border: '#ec4899' },
    { id: 'baby-pink', label: 'Baby Pink', color: '#ffe4e6', border: '#f43f5e' },
    { id: 'ocean', label: 'Ocean', color: '#09213b', border: '#0ea5e9' }
];

export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeTheme = THEMES.find(t => t.id === theme) || THEMES[0];

    return (
        <div className="relative" ref={dropdownRef}>
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 text-sm font-semibold rounded-xl
                    bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.08] 
                    transition-all duration-300 shrink-0"
                title="Change Theme"
            >
                <div 
                    className="w-3.5 h-3.5 rounded-full border border-white/20" 
                    style={{ backgroundColor: activeTheme.color, borderColor: activeTheme.border }}
                />
                <span className="hidden sm:inline">Theme</span>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 w-40 p-2 rounded-xl glass-card border border-white/10 z-[100]"
                    >
                        <div className="flex flex-col gap-1">
                            {THEMES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setTheme(t.id);
                                        setIsOpen(false);
                                    }}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        theme === t.id 
                                        ? 'bg-white/10 text-white' 
                                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                    }`}
                                >
                                    <div 
                                        className="w-3 h-3 rounded-full shadow-sm" 
                                        style={{ backgroundColor: t.color, border: \`1px solid \${t.border}\` }}
                                    />
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
