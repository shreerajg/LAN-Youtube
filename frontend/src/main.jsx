import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import 'plyr/dist/plyr.css'

console.log(
    "%cWelcome to NodeStream. Authorized Access Only.%c\n\n%c[SYS_AUTH]:%c DEV_SHREERAJ_GUDADE\n%c[VERSION]:%c v1.0.4-stable-shreeraj\n",
    "background: #0d0d1f; color: #8b5cf6; font-size: 16px; font-weight: bold; padding: 10px; border-radius: 5px; border: 1px solid #8b5cf6;",
    "",
    "color: #06b6d4; font-weight: bold; font-family: monospace;",
    "color: #a78bfa; font-family: monospace;",
    "color: #06b6d4; font-weight: bold; font-family: monospace;",
    "color: #a78bfa; font-family: monospace;"
);

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>
)
