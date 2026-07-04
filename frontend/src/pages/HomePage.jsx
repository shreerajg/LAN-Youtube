                                <div className="relative px-6 py-3 bg-black/40 ring-1 ring-white/10 backdrop-blur-sm rounded-lg flex items-center gap-3">
                                    <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-violet-500 to-cyan-500 animate-pulse"></div>
                                    <span className="text-slate-400 text-sm font-medium tracking-wide">
                                        Architected & Engineered by
                                    </span>
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 font-black tracking-widest text-lg font-['Space_Grotesk'] hover:scale-105 transition-transform duration-300">
                                        SHREERAJ
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {playlistVideo && (
                <PlaylistManager
                    videoId={playlistVideo.id}
                    onClose={() => setPlaylistVideo(null)}
                />
            )}
        </div>
    )
}
