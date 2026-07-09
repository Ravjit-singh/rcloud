const RPlayer = {
    video: null,
    container: null,
    hideTimer: null,
    isDragging: false,

    init(parentElement, src, title) {
        // Dynamically figure out how to close the modal depending on if we are in the main app or a public link
        const closeAction = typeof ui !== 'undefined' ? 'ui.closePreview()' : 'closePreview()';

        parentElement.innerHTML = `
            <div id="rp-container" class="relative w-full h-full bg-black flex flex-col justify-center items-center overflow-hidden font-sans select-none">
                
                <video id="rp-video" class="w-full h-full object-contain" src="${src}" autoplay></video>
                
                <div id="rp-left-zone" class="absolute left-0 top-0 bottom-24 w-1/3 z-10 cursor-pointer"></div>
                <div id="rp-right-zone" class="absolute right-0 top-0 bottom-24 w-1/3 z-10 cursor-pointer"></div>
                <div id="rp-center-zone" class="absolute left-1/3 right-1/3 top-0 bottom-24 z-10 cursor-pointer"></div>

                <div id="rp-anim" class="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div id="rp-anim-icon" class="bg-black/50 text-white rounded-full p-4 transform scale-150 opacity-0 transition-all duration-300 flex items-center justify-center">
                        <span class="material-symbols-rounded filled text-[48px]">play_arrow</span>
                    </div>
                </div>

                <div id="rp-loader" class="absolute inset-0 flex items-center justify-center pointer-events-none hidden z-20">
                    <span class="material-symbols-rounded animate-spin text-[64px] text-[#E50914]">progress_activity</span>
                </div>

                <div id="rp-ui" class="absolute inset-0 flex flex-col justify-between z-30 transition-opacity duration-300 pointer-events-none">
                    
                    <div class="w-full bg-gradient-to-b from-black/90 to-transparent p-4 md:p-6 pointer-events-auto flex justify-between items-center">
                        <div class="flex items-center space-x-4">
                            <button onclick="${closeAction}" class="text-white hover:text-gray-300 transition p-2"><span class="material-symbols-rounded text-[32px]">arrow_back</span></button>
                            <h2 class="text-white font-medium text-lg lg:text-xl drop-shadow-md truncate max-w-[200px] sm:max-w-md lg:max-w-2xl">${title}</h2>
                        </div>
                    </div>

                    <div class="w-full bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 md:p-8 pointer-events-auto">
                        
                        <div id="rp-timeline" class="relative w-full h-1.5 bg-white/30 rounded-full cursor-pointer group mb-4 hover:h-2.5 transition-all duration-200">
                            <div id="rp-buffered" class="absolute top-0 left-0 bottom-0 bg-white/50 rounded-full pointer-events-none" style="width: 0%"></div>
                            <div id="rp-progress" class="absolute top-0 left-0 bottom-0 bg-[#E50914] rounded-full pointer-events-none flex justify-end items-center" style="width: 0%">
                                <div class="w-4 h-4 bg-[#E50914] rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform absolute -right-2"></div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3 md:space-x-6 text-white">
                                <button id="rp-play" class="hover:text-gray-300 transition p-1"><span class="material-symbols-rounded filled text-[36px] md:text-[42px]">pause</span></button>
                                <button id="rp-rewind" class="hover:text-gray-300 transition p-1"><span class="material-symbols-rounded text-[32px] md:text-[36px]">replay_10</span></button>
                                <button id="rp-forward" class="hover:text-gray-300 transition p-1"><span class="material-symbols-rounded text-[32px] md:text-[36px]">forward_10</span></button>
                                <button id="rp-mute" class="hover:text-gray-300 transition p-1 hidden sm:block"><span class="material-symbols-rounded text-[28px] md:text-[32px]">volume_up</span></button>
                                
                                <span id="rp-time" class="text-[13px] md:text-[15px] font-medium tracking-wide drop-shadow-md pl-2">00:00 / 00:00</span>
                            </div>

                            <div class="flex items-center text-white">
                                <button id="rp-fullscreen" class="hover:text-gray-300 transition p-1"><span class="material-symbols-rounded text-[32px] md:text-[36px]">fullscreen</span></button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;

        this.video = document.getElementById('rp-video');
        this.container = document.getElementById('rp-container');
        this.ui = document.getElementById('rp-ui');
        this.isDragging = false;
        
        this.bindEvents();
        this.startHideTimer();
    },

    bindEvents() {
        const v = this.video;
        const playBtn = document.getElementById('rp-play');
        const animIcon = document.getElementById('rp-anim-icon');
        const loader = document.getElementById('rp-loader');
        const progress = document.getElementById('rp-progress');
        const buffered = document.getElementById('rp-buffered');
        const timeDisplay = document.getElementById('rp-time');
        const timeline = document.getElementById('rp-timeline');

        const triggerAnim = (icon) => {
            animIcon.innerHTML = `<span class="material-symbols-rounded filled text-[48px] md:text-[64px]">${icon}</span>`;
            animIcon.parentElement.classList.remove('opacity-0', 'scale-150');
            animIcon.parentElement.classList.add('opacity-100', 'scale-100');
            setTimeout(() => {
                animIcon.parentElement.classList.remove('opacity-100', 'scale-100');
                animIcon.parentElement.classList.add('opacity-0', 'scale-150');
            }, 400);
        };

        // Play/Pause Engine
        const togglePlay = () => {
            if (v.paused) { v.play(); triggerAnim('play_arrow'); } 
            else { v.pause(); triggerAnim('pause'); }
            this.startHideTimer();
        };

        document.getElementById('rp-center-zone').onclick = togglePlay;
        playBtn.onclick = togglePlay;

        v.onplay = () => playBtn.innerHTML = '<span class="material-symbols-rounded filled text-[36px] md:text-[42px]">pause</span>';
        v.onpause = () => playBtn.innerHTML = '<span class="material-symbols-rounded filled text-[36px] md:text-[42px]">play_arrow</span>';

        // Fast Forward & Rewind Engine (10 seconds)
        const seek = (seconds) => {
            v.currentTime += seconds;
            triggerAnim(seconds > 0 ? 'forward_10' : 'replay_10');
            this.startHideTimer();
        };

        // Double Tap Math for Mobile Devices
        let lastTapLeft = 0;
        let lastTapRight = 0;
        
        document.getElementById('rp-left-zone').ontouchstart = (e) => {
            const currentTime = new Date().getTime();
            if (currentTime - lastTapLeft < 300) { seek(-10); e.preventDefault(); }
            lastTapLeft = currentTime;
        };
        document.getElementById('rp-right-zone').ontouchstart = (e) => {
            const currentTime = new Date().getTime();
            if (currentTime - lastTapRight < 300) { seek(10); e.preventDefault(); }
            lastTapRight = currentTime;
        };

        // Desktop double clicks
        document.getElementById('rp-left-zone').ondblclick = () => seek(-10);
        document.getElementById('rp-right-zone').ondblclick = () => seek(10);
        
        // UI Buttons
        document.getElementById('rp-rewind').onclick = () => seek(-10);
        document.getElementById('rp-forward').onclick = () => seek(10);

        // Core Timers
        v.ontimeupdate = () => {
            if (!this.isDragging) {
                const percent = (v.currentTime / v.duration) * 100;
                progress.style.width = `${percent}%`;
                timeDisplay.textContent = `${this.formatTime(v.currentTime)} / ${this.formatTime(v.duration)}`;
            }
        };

        v.onprogress = () => {
            if (v.buffered.length > 0) {
                const bufferedEnd = v.buffered.end(v.buffered.length - 1);
                buffered.style.width = `${(bufferedEnd / v.duration) * 100}%`;
            }
        };

        v.onloadedmetadata = () => { timeDisplay.textContent = `00:00 / ${this.formatTime(v.duration)}`; };
        v.onwaiting = () => loader.classList.remove('hidden');
        v.onplaying = () => loader.classList.add('hidden');

        // Flawless Scrubber Engine
        const updateScrub = (e) => {
            const rect = timeline.getBoundingClientRect();
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            let pos = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const percent = pos / rect.width;
            progress.style.width = `${percent * 100}%`;
            v.currentTime = percent * v.duration;
            timeDisplay.textContent = `${this.formatTime(v.currentTime)} / ${this.formatTime(v.duration)}`;
        };

        timeline.onmousedown = (e) => { this.isDragging = true; updateScrub(e); };
        timeline.ontouchstart = (e) => { this.isDragging = true; updateScrub(e); };
        
        document.addEventListener('mousemove', (e) => { if (this.isDragging) updateScrub(e); });
        document.addEventListener('touchmove', (e) => { if (this.isDragging) updateScrub(e); }, { passive: false });
        
        document.addEventListener('mouseup', () => { this.isDragging = false; });
        document.addEventListener('touchend', () => { this.isDragging = false; });

        // Mute Toggle
        const muteBtn = document.getElementById('rp-mute');
        muteBtn.onclick = () => {
            v.muted = !v.muted;
            muteBtn.innerHTML = v.muted ? '<span class="material-symbols-rounded text-[28px] md:text-[32px]">volume_off</span>' : '<span class="material-symbols-rounded text-[28px] md:text-[32px]">volume_up</span>';
            this.startHideTimer();
        };

        // Fullscreen Toggle
        document.getElementById('rp-fullscreen').onclick = () => {
            if (!document.fullscreenElement) {
                if (this.container.requestFullscreen) this.container.requestFullscreen();
                else if (this.container.webkitRequestFullscreen) this.container.webkitRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
            this.startHideTimer();
        };

        // Auto-Hide HUD Logic
        this.container.onmousemove = () => this.startHideTimer();
        this.container.onclick = () => this.startHideTimer();
        this.container.ontouchstart = () => this.startHideTimer();
    },

    startHideTimer() {
        this.ui.classList.remove('opacity-0');
        this.container.style.cursor = 'default';
        clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => {
            if (!this.video.paused && !this.isDragging) {
                this.ui.classList.add('opacity-0');
                this.container.style.cursor = 'none';
            }
        }, 3000); // UI Fades to black after 3 seconds
    },

    formatTime(sec) {
        if (isNaN(sec)) return "00:00";
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    destroy() {
        if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); }
        clearTimeout(this.hideTimer);
    }
};
