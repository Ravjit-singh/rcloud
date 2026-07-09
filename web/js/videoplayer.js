const RPlayer = {
    video: null,
    container: null,
    hideTimer: null,

    init(parentElement, src, title) {
        parentElement.innerHTML = `
            <div id="rp-container" class="relative w-full max-w-6xl aspect-video bg-black rounded-lg md:rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center group cursor-default">
                <video id="rp-video" class="w-full h-full object-contain" src="${src}" autoplay preload="auto"></video>
                
                <div id="rp-loader" class="absolute inset-0 flex items-center justify-center pointer-events-none hidden">
                    <span class="material-symbols-rounded animate-spin text-[48px] text-md-accent">progress_activity</span>
                </div>

                <div id="rp-rewind-zone" class="absolute left-0 top-0 bottom-16 w-1/3 z-10"></div>
                <div id="rp-forward-zone" class="absolute right-0 top-0 bottom-16 w-1/3 z-10"></div>

                <div id="rp-center-anim" class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-300 transform scale-150 z-20">
                    <div class="bg-black/50 rounded-full p-4 flex items-center justify-center">
                        <span id="rp-center-icon" class="material-symbols-rounded filled text-white text-[48px]">play_arrow</span>
                    </div>
                </div>

                <div id="rp-ui" class="absolute inset-0 flex flex-col justify-between z-30 transition-opacity duration-500 bg-gradient-to-t from-black/90 via-transparent to-black/60">
                    
                    <div class="flex justify-between items-center p-4 md:p-6">
                        <span class="text-white font-medium text-lg drop-shadow-md truncate pr-4">${title}</span>
                        <div class="relative">
                            <button id="rp-audio-btn" class="p-2 rounded-full hover:bg-white/20 transition text-white hidden">
                                <span class="material-symbols-rounded">subtitles</span>
                            </button>
                            <div id="rp-audio-menu" class="hidden absolute top-12 right-0 bg-[#1e1f20]/95 backdrop-blur-md border border-[#444746] rounded-xl shadow-2xl py-2 w-48 overflow-hidden">
                                <div class="px-4 py-2 text-xs font-medium text-md-text-muted uppercase">Audio Tracks</div>
                                <div id="rp-audio-list"></div>
                            </div>
                        </div>
                    </div>

                    <div class="px-4 md:px-6 pb-4 md:pb-6 flex flex-col">
                        
                        <div class="flex items-center group/timeline cursor-pointer h-6 mb-1 relative" id="rp-timeline-container">
                            <div class="w-full h-1.5 bg-white/30 rounded-full relative overflow-hidden transition-all group-hover/timeline:h-2.5">
                                <div id="rp-progress" class="absolute top-0 left-0 bottom-0 bg-md-accent w-0 pointer-events-none"></div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between mt-2">
                            <div class="flex items-center space-x-2 md:space-x-4 text-white">
                                <button id="rp-play-btn" class="hover:text-md-accent transition"><span class="material-symbols-rounded filled text-[32px]">pause</span></button>
                                <button id="rp-rewind-btn" class="hover:text-md-accent transition hidden sm:block"><span class="material-symbols-rounded text-[28px]">replay_10</span></button>
                                <button id="rp-forward-btn" class="hover:text-md-accent transition hidden sm:block"><span class="material-symbols-rounded text-[28px]">forward_10</span></button>
                                <button id="rp-mute-btn" class="hover:text-md-accent transition"><span class="material-symbols-rounded text-[28px]">volume_up</span></button>
                                <span id="rp-time" class="text-sm font-medium tracking-wide drop-shadow-sm ml-2">00:00 / 00:00</span>
                            </div>

                            <div class="flex items-center text-white">
                                <button id="rp-fullscreen-btn" class="hover:text-md-accent transition"><span class="material-symbols-rounded text-[28px]">fullscreen</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.video = document.getElementById('rp-video');
        this.container = document.getElementById('rp-container');
        this.ui = document.getElementById('rp-ui');
        
        this.bindEvents();
        this.startInactivityTimer();
    },

    bindEvents() {
        const v = this.video;
        const playBtn = document.getElementById('rp-play-btn');
        const muteBtn = document.getElementById('rp-mute-btn');
        const timeDisplay = document.getElementById('rp-time');
        const progress = document.getElementById('rp-progress');
        const timeline = document.getElementById('rp-timeline-container');
        const loader = document.getElementById('rp-loader');

        // Play/Pause
        const togglePlay = () => { if (v.paused) v.play(); else v.pause(); };
        playBtn.onclick = togglePlay;
        v.onclick = togglePlay;
        
        v.onplay = () => { playBtn.innerHTML = '<span class="material-symbols-rounded filled text-[32px]">pause</span>'; this.animateCenter('pause'); };
        v.onpause = () => { playBtn.innerHTML = '<span class="material-symbols-rounded filled text-[32px]">play_arrow</span>'; this.animateCenter('play_arrow'); this.ui.classList.remove('opacity-0'); };

        // Buffer Loading
        v.onwaiting = () => loader.classList.remove('hidden');
        v.onplaying = () => loader.classList.add('hidden');

        // Time Updates
        v.ontimeupdate = () => {
            progress.style.width = `${(v.currentTime / v.duration) * 100}%`;
            timeDisplay.textContent = `${this.formatTime(v.currentTime)} / ${this.formatTime(v.duration)}`;
        };

        v.onloadedmetadata = () => {
            timeDisplay.textContent = `00:00 / ${this.formatTime(v.duration)}`;
            this.setupAudioTracks();
        };

        // Timeline Scrubbing
        let isDragging = false;
        const scrub = (e) => {
            const rect = timeline.getBoundingClientRect();
            let pos = (e.clientX || e.touches[0].clientX) - rect.left;
            pos = Math.max(0, Math.min(pos, rect.width));
            v.currentTime = (pos / rect.width) * v.duration;
        };
        timeline.onmousedown = (e) => { isDragging = true; scrub(e); };
        timeline.ontouchstart = (e) => { isDragging = true; scrub(e); };
        document.onmouseup = () => isDragging = false;
        document.ontouchend = () => isDragging = false;
        document.onmousemove = (e) => { if(isDragging) scrub(e); };
        document.ontouchmove = (e) => { if(isDragging) scrub(e); };

        // Mute
        muteBtn.onclick = () => {
            v.muted = !v.muted;
            muteBtn.innerHTML = v.muted ? '<span class="material-symbols-rounded text-[28px]">volume_off</span>' : '<span class="material-symbols-rounded text-[28px]">volume_up</span>';
        };

        // +/- 10 Seconds (Double Tap Zones)
        document.getElementById('rp-rewind-zone').ondblclick = () => { v.currentTime -= 10; this.animateCenter('replay_10'); };
        document.getElementById('rp-forward-zone').ondblclick = () => { v.currentTime += 10; this.animateCenter('forward_10'); };
        document.getElementById('rp-rewind-btn').onclick = () => { v.currentTime -= 10; };
        document.getElementById('rp-forward-btn').onclick = () => { v.currentTime += 10; };

        // Fullscreen
        document.getElementById('rp-fullscreen-btn').onclick = () => {
            if (!document.fullscreenElement) {
                if (this.container.requestFullscreen) this.container.requestFullscreen();
                else if (this.container.webkitRequestFullscreen) this.container.webkitRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
        };

        // UI Auto-Hide
        this.container.onmousemove = () => this.startInactivityTimer();
        this.container.ontouchstart = () => this.startInactivityTimer();
    },

    animateCenter(iconName) {
        const anim = document.getElementById('rp-center-anim');
        document.getElementById('rp-center-icon').textContent = iconName;
        anim.classList.remove('opacity-0', 'scale-150');
        anim.classList.add('opacity-100', 'scale-100');
        setTimeout(() => {
            anim.classList.remove('opacity-100', 'scale-100');
            anim.classList.add('opacity-0', 'scale-150');
        }, 400);
    },

    startInactivityTimer() {
        this.ui.classList.remove('opacity-0');
        this.container.style.cursor = 'default';
        clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => {
            if (!this.video.paused) {
                this.ui.classList.add('opacity-0');
                this.container.style.cursor = 'none';
                document.getElementById('rp-audio-menu').classList.add('hidden');
            }
        }, 3000);
    },

    setupAudioTracks() {
        // Advanced feature: Extracts hardware multi-track audio if the WebView allows it
        const btn = document.getElementById('rp-audio-btn');
        const menu = document.getElementById('rp-audio-menu');
        const list = document.getElementById('rp-audio-list');

        if (this.video.audioTracks && this.video.audioTracks.length > 1) {
            btn.classList.remove('hidden');
            btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); };
            
            list.innerHTML = '';
            for (let i = 0; i < this.video.audioTracks.length; i++) {
                const track = this.video.audioTracks[i];
                const div = document.createElement('button');
                div.className = `w-full text-left px-4 py-3 text-[14px] hover:bg-white/10 flex items-center transition ${track.enabled ? 'text-md-accent' : 'text-md-text'}`;
                div.innerHTML = `<span class="material-symbols-rounded mr-3 text-[18px] ${track.enabled ? 'opacity-100' : 'opacity-0'}">check</span> Track ${i + 1} ${track.language ? `(${track.language})` : ''}`;
                
                div.onclick = () => {
                    for (let j = 0; j < this.video.audioTracks.length; j++) {
                        this.video.audioTracks[j].enabled = (j === i);
                    }
                    menu.classList.add('hidden');
                    this.setupAudioTracks(); // Refresh UI
                };
                list.appendChild(div);
            }
        }
    },

    formatTime(seconds) {
        if (isNaN(seconds)) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    destroy() {
        if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); }
        clearTimeout(this.hideTimer);
    }
};
