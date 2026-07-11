import React, { createContext, useContext, useState, useEffect } from 'react';

const FontContext = createContext();

export function FontProvider({ children }) {
    const [font, setFont] = useState(() => {
        return localStorage.getItem('app-font') || 'inter';
    });

    useEffect(() => {
        localStorage.setItem('app-font', font);
        document.documentElement.setAttribute('data-font', font);
    }, [font]);

    return (
        <FontContext.Provider value={{ font, setFont }}>
            {children}
        </FontContext.Provider>
    );
}

export function useFont() {
    return useContext(FontContext);
}
