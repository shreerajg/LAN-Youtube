import React, { useState, useEffect, useRef } from 'react'
import { getWsUrl } from '../api'

export default function ChatPage() {
    const [messages, setMessages] = useState([])
    const [roster, setRoster] = useState([])
    const [input, setInput] = useState('')
    const [myName, setMyName] = useState('')
    const [connected, setConnected] = useState(false)
    const wsRef = useRef(null)
    const messagesEndRef = useRef(null)

    useEffect(() => {
        // Retrieve name from local storage or prompt
        let name = localStorage.getItem('lan_chat_name')
        if (!name) {
            name = prompt('Enter your chat name:') || 'Anonymous'
            localStorage.setItem('lan_chat_name', name)
        }
        setMyName(name)

        const wsUrl = `${getWsUrl()}?name=${encodeURIComponent(name)}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            setConnected(true)
        }

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            
            if (data.type === 'init') {
                setMessages(data.history)
                setRoster(data.roster)
            } else if (data.type === 'message' || data.type === 'system' || data.type === 'clipboard') {
                setMessages(prev => [...prev, data].slice(-200)) // Keep last 200
            } else if (data.type === 'roster_update') {
                 // The server currently sends roster on init, and updates on join/leave via system messages.
                 // For a robust roster, we'd need full roster broadcasts, but we can do a simple version.
            }
        }

        ws.onclose = () => {
            setConnected(false)
            setMessages(prev => [...prev, {
                type: 'system',
                text: 'Disconnected from chat server. Refresh to reconnect.',
                timestamp: new Date().toISOString()
            }])
        }

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close()
            }
        }
    }, [])

    useEffect(() => {
        // Auto scroll to bottom
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const sendMessage = (e) => {
        e.preventDefault()
        if (!input.trim() || !connected) return

        wsRef.current.send(JSON.stringify({
            type: 'message',
            text: input
        }))
        setInput('')
    }

    const changeName = () => {
        const newName = prompt('Enter new name:', myName)
        if (newName && newName !== myName) {
            localStorage.setItem('lan_chat_name', newName)
            setMyName(newName)
            if (connected) {
                wsRef.current.send(JSON.stringify({
                    type: 'rename',
                    name: newName
                }))
            }
        }
    }

    return (
        <div className="pt-20 sm:pt-24 pb-2 sm:pb-8 px-2 sm:px-8 max-w-5xl mx-auto h-[calc(100dvh-80px)] sm:h-[100dvh] flex flex-col">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-pink-500">
                        LAN Chat
                    </h1>
                    <p className="text-muted text-sm mt-1">Real-time chat with everyone on the network.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-text">
                        {myName}
                    </span>
                    <button 
                        onClick={changeName}
                        className="text-xs bg-surface2 px-2 py-1 rounded border border-border hover:border-violet-500/50"
                    >
                        Change
                    </button>
                    <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`} title={connected ? 'Connected' : 'Disconnected'} />
                </div>
            </div>

            <div className="flex-1 bg-surface rounded-2xl border border-border overflow-hidden flex flex-col shadow-2xl">
                {/* Chat Area */}
                <div className="flex-1 p-4 overflow-y-auto bg-bg flex flex-col gap-3 min-h-[50vh]">
                    {messages.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-muted opacity-50 text-sm italic">
                            No messages yet. Say hi!
                        </div>
                    )}
                    {messages.map((msg, idx) => {
                        if (msg.type === 'system' || msg.type === 'clipboard') {
                            return (
                                <div key={idx} className="flex justify-center my-2">
                                    <span className="text-xs text-muted bg-surface2 px-3 py-1 rounded-full border border-border">
                                        {msg.text}
                                    </span>
                                </div>
                            )
                        }

                        // Regular message
                        const isMe = msg.name === myName // simple check, ideally by client_id
                        return (
                            <div key={idx} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                {!isMe && (
                                    <span className="text-xs font-semibold mb-1 ml-1" style={{ color: msg.color }}>
                                        {msg.name}
                                    </span>
                                )}
                                <div 
                                    className={`px-4 py-2 rounded-2xl ${
                                        isMe 
                                        ? 'bg-violet-600 text-white rounded-br-sm' 
                                        : 'bg-surface2 text-text border border-border rounded-bl-sm'
                                    }`}
                                    style={!isMe ? { borderLeftColor: msg.color, borderLeftWidth: '3px' } : {}}
                                >
                                    <p className="whitespace-pre-wrap break-words text-sm">{msg.text}</p>
                                </div>
                                <span className="text-[10px] text-muted mt-1 mx-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                        )
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-surface2 border-t border-border">
                    <form onSubmit={sendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-text"
                            disabled={!connected}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || !connected}
                            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl font-medium transition-colors"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
