const socket = io();

// UI Elementleri
const createScreen = document.getElementById('create-screen');
const passwordScreen = document.getElementById('password-screen');
const mainScreen = document.getElementById('main-screen');
const newRoomPassInput = document.getElementById('new-room-pass');
const createBtn = document.getElementById('create-btn');
const joinUsername = document.getElementById('join-username');
const joinPassword = document.getElementById('join-password');
const joinBtn = document.getElementById('join-btn');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const ytUrlInput = document.getElementById('youtube-url');
const loadBtn = document.getElementById('load-btn');
const copyLinkBtn = document.getElementById('copy-link-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');

// Sohbet Baloncuğu
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatCloseBtn = document.getElementById('chat-close-btn');
const chatPanel = document.getElementById('chat-panel');
const unreadBadge = document.getElementById('unread-badge');
let unreadCount = 0;
let dragHasMovedChat = false;
chatToggleBtn.addEventListener('click', (e) => { 
    if (dragHasMovedChat) return;
    chatPanel.classList.remove('chat-closed'); unreadCount = 0; unreadBadge.classList.add('hidden'); 
});
chatCloseBtn.addEventListener('click', () => { chatPanel.classList.add('chat-closed'); });

let player; let isUserAction = true; let currentRoomId = null; let myId = null; let currentHostId = null; let isFreeControl = false;
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('oda');
if (roomParam) { currentRoomId = roomParam; passwordScreen.classList.remove('hidden'); } 
else { createScreen.classList.remove('hidden'); }

function appendMessage(data) {
    const div = document.createElement('div');
    div.classList.add('message'); div.style.borderLeftColor = data.color;

    let text = data.text;
    const match = text.match(/(https?:\/\/)?(www\.)?(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?\s]*)/);
    let playBtnHtml = '';
    if (match && match[4].length === 11) {
        playBtnHtml = `<div style="margin-top: 5px;"><button class="outline-btn" style="padding: 2px 8px; font-size:12px; height:auto; display:inline-block;" onclick="socket.emit('loadVideo', '${match[4]}')"><i class="fas fa-play"></i> Oynat</button></div>`;
        text = text.replace(match[0], `<a href="${match[0].startsWith('http') ? match[0] : 'https://' + match[0]}" target="_blank" style="color:#00CED1; text-decoration:none;">${match[0]}</a>`);
    }

    div.innerHTML = `<div class="user" style="color: ${data.color}">${data.user}</div><div>${text}</div>${playBtnHtml}`;
    chatMessages.appendChild(div); chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (chatPanel.classList.contains('chat-closed')) {
        chatToggleBtn.style.transform = 'scale(1.2)';
        setTimeout(() => chatToggleBtn.style.transform = 'scale(1)', 200);
        unreadCount++; unreadBadge.innerText = unreadCount; unreadBadge.classList.remove('hidden');
    }
}

createBtn.addEventListener('click', () => {
    const pass = newRoomPassInput.value.trim();
    if (!pass) return alert("Şifre belirleyin!");
    socket.emit('createRoom', pass, (roomId) => { window.location.href = `?oda=${roomId}`; });
});

joinBtn.addEventListener('click', () => {
    const username = joinUsername.value.trim(); const password = joinPassword.value.trim();
    if (!username || !password) return alert("Kullanıcı adı ve şifre zorunludur!");
    socket.emit('joinRoom', { roomId: currentRoomId, password, username }, (response) => {
        if (response.success) {
            myId = response.myId; currentHostId = response.hostId; isFreeControl = response.freeControl;
            updateVideoControlsUI();
            
            passwordScreen.classList.add('hidden'); mainScreen.classList.remove('hidden');
            chatMessages.innerHTML = ''; 
            if (response.messages) response.messages.forEach(msg => appendMessage(msg));
            if (player && player.loadVideoById) {
                isUserAction = false;
                if (response.isPlaying) player.loadVideoById(response.videoId, response.time);
                else player.cueVideoById(response.videoId, response.time);
                setTimeout(() => isUserAction = true, 1000);
            }
        } else alert(response.message);
    });
});

function updateVideoControlsUI() {
    const isHost = (myId === currentHostId);
    const roomControlBtn = document.getElementById('room-control-btn');
    if (roomControlBtn) {
        if (isHost) {
            roomControlBtn.classList.remove('hidden');
            if (isFreeControl) {
                roomControlBtn.innerHTML = '<i class="fas fa-unlock"></i> Herkes Açabilir';
                roomControlBtn.style.color = '#00CED1'; roomControlBtn.style.borderColor = '#00CED1';
            } else {
                roomControlBtn.innerHTML = '<i class="fas fa-lock"></i> Sadece Yönetici';
                roomControlBtn.style.color = '#ffb703'; roomControlBtn.style.borderColor = '#ffb703';
            }
        } else {
            roomControlBtn.classList.add('hidden');
        }
    }

    const hasControl = (isHost || isFreeControl);
    const urlInput = document.getElementById('youtube-url');
    if (urlInput) urlInput.disabled = !hasControl;
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) loadBtn.disabled = !hasControl;
    const playBtn = document.getElementById('custom-play-btn');
    if (playBtn) playBtn.style.display = hasControl ? 'flex' : 'none';
    const progBar = document.getElementById('progress-bar');
    if (progBar) progBar.style.pointerEvents = hasControl ? 'auto' : 'none';
    const overlay = document.getElementById('player-overlay');
    if (overlay) overlay.style.pointerEvents = hasControl ? 'auto' : 'none';
}

copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href); copyLinkBtn.innerHTML = "Kopyalandı!";
    setTimeout(() => { copyLinkBtn.innerHTML = '<span class="hide-mobile">Davet Linki</span><i class="fas fa-link show-mobile-inline"></i>'; }, 2000);
});

sendBtn.addEventListener('click', () => {
    const msg = msgInput.value.trim();
    if (msg) { socket.emit('chatMessage', msg); msgInput.value = ''; }
});
msgInput.addEventListener('keypress', e => e.key === 'Enter' && sendBtn.click());
socket.on('message', appendMessage);

// YOUTUBE KONTROLLERİ
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', { height: '100%', width: '100%', videoId: '', playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'rel': 0, 'modestbranding': 1 }, events: { 'onStateChange': onPlayerStateChange, 'onReady': onPlayerReady } });
}

let uiInterval;
function onPlayerReady(event) {
    initCustomControls();
}

function onPlayerStateChange(event) {
    const playBtnIcon = document.querySelector('#custom-play-btn i');
    if (event.data == YT.PlayerState.PLAYING) {
        if (playBtnIcon) { playBtnIcon.classList.remove('fa-play'); playBtnIcon.classList.add('fa-pause'); }
        if (isUserAction) socket.emit('playVideo', player.getCurrentTime());
    }
    else if (event.data == YT.PlayerState.PAUSED) {
        if (playBtnIcon) { playBtnIcon.classList.remove('fa-pause'); playBtnIcon.classList.add('fa-play'); }
        if (isUserAction) socket.emit('pauseVideo', player.getCurrentTime());
    }
}
loadBtn.addEventListener('click', () => {
    const url = ytUrlInput.value; const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    const videoId = (match && match[2].length === 11) ? match[2] : null;
    if (videoId) { socket.emit('loadVideo', videoId); ytUrlInput.value = ''; } else alert("Geçerli bir YouTube linki girin!");
});
socket.on('videoChange', (videoId) => { if(player && player.loadVideoById) { isUserAction = false; player.loadVideoById(videoId); setTimeout(() => isUserAction = true, 1000); } });
socket.on('videoPlay', (time) => { if(player && player.playVideo) { isUserAction = false; if (Math.abs(player.getCurrentTime() - time) > 2) player.seekTo(time); player.playVideo(); setTimeout(() => isUserAction = true, 500); } });
socket.on('videoPause', () => { if(player && player.pauseVideo) { isUserAction = false; player.pauseVideo(); setTimeout(() => isUserAction = true, 500); } });

// -- ÖZEL KONTROL ÇUBUĞU MANTIĞI --
function formatTime(seconds) {
    const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function initCustomControls() {
    const playBtn = document.getElementById('custom-play-btn');
    const playIcon = playBtn.querySelector('i');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    const progressBar = document.getElementById('progress-bar');
    const muteBtn = document.getElementById('custom-mute-btn');
    const muteIcon = muteBtn.querySelector('i');
    const volumeBar = document.getElementById('volume-bar');
    let isDragging = false;

    playBtn.addEventListener('click', () => {
        if (player.getPlayerState() == YT.PlayerState.PLAYING) { player.pauseVideo(); playIcon.className = 'fas fa-play'; }
        else { player.playVideo(); playIcon.className = 'fas fa-pause'; }
    });

    muteBtn.addEventListener('click', () => {
        if (player.isMuted()) { player.unMute(); muteIcon.className = 'fas fa-volume-up'; volumeBar.value = player.getVolume(); }
        else { player.mute(); muteIcon.className = 'fas fa-volume-mute'; volumeBar.value = 0; }
        updateBarColor(volumeBar);
    });

    volumeBar.addEventListener('input', (e) => {
        const val = e.target.value;
        player.setVolume(val);
        if (val == 0) { player.mute(); muteIcon.className = 'fas fa-volume-mute'; }
        else { player.unMute(); muteIcon.className = val > 50 ? 'fas fa-volume-up' : 'fas fa-volume-down'; }
        updateBarColor(e.target);
    });

    progressBar.addEventListener('mousedown', () => isDragging = true);
    progressBar.addEventListener('touchstart', () => isDragging = true);
    
    progressBar.addEventListener('input', (e) => { updateBarColor(e.target); });

    progressBar.addEventListener('change', (e) => {
        const duration = player.getDuration();
        const seekTime = (e.target.value / 100) * duration;
        player.seekTo(seekTime, true);
        isDragging = false;
    });

    function updateBarColor(el) {
        el.style.background = `linear-gradient(to right, #6b7a8a ${el.value}%, #444 ${el.value}%)`;
    }

    // Default Volume 15%
    player.unMute();
    player.setVolume(15);
    volumeBar.value = 15;
    muteIcon.className = 'fas fa-volume-down';
    updateBarColor(volumeBar);

    if(uiInterval) clearInterval(uiInterval);
    uiInterval = setInterval(() => {
        if (player && player.getCurrentTime && player.getDuration) {
            const current = player.getCurrentTime() || 0;
            const duration = player.getDuration() || 0;
            currentTimeEl.innerText = formatTime(current);
            totalTimeEl.innerText = formatTime(duration);
            if (!isDragging && duration > 0) {
                const percent = (current / duration) * 100;
                progressBar.value = percent;
                updateBarColor(progressBar);
            }
        }
    }, 500);
    
    volumeBar.value = player.getVolume(); updateBarColor(volumeBar);

    // Auto-hide controls logic
    let controlsTimeout;
    const videoSection = document.querySelector('.video-section');
    const customControls = document.getElementById('custom-video-controls');
    
    function showControls() {
        customControls.classList.add('active');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            customControls.classList.remove('active');
        }, 3000);
    }
    
    videoSection.addEventListener('mousemove', showControls);
    videoSection.addEventListener('click', showControls);
    videoSection.addEventListener('touchstart', showControls);
    videoSection.addEventListener('mouseleave', () => {
        clearTimeout(controlsTimeout);
        customControls.classList.remove('active');
    });
    
    // Prevent hiding while hovering over the controls themselves
    customControls.addEventListener('mouseenter', () => clearTimeout(controlsTimeout));
    customControls.addEventListener('mousemove', showControls);
    
    // Allow clicking the video to play/pause since overlay blocks iframe
    const playerOverlay = document.getElementById('player-overlay');
    if (playerOverlay) {
        playerOverlay.addEventListener('click', () => {
            if (player && player.getPlayerState) {
                if (player.getPlayerState() == YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                    playIcon.className = 'fas fa-play';
                } else {
                    player.playVideo();
                    playIcon.className = 'fas fa-pause';
                }
            }
        });
    }
    
    showControls(); // show once initially
}

// --- WEBRTC ---
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const toggleScreenBtn = document.getElementById('toggle-screen-btn');
const cameraBoxesContainer = document.getElementById('camera-boxes-container');
const localVideo = document.getElementById('local-video');
const localCameraBox = document.getElementById('local-camera-box');
const participantsBtn = document.getElementById('participants-btn');
const participantsDropdown = document.getElementById('participants-dropdown');
const participantsList = document.getElementById('participants-list');
const userCountSpan = document.getElementById('user-count');

let localStream = null; let screenStream = null;
let isMicOn = false; let isCamOn = false; let isScreenSharing = false;
let currentUsers = {}; 
const peers = {}; const locallyMutedUsers = new Set(); 
const configuration = { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] };

let mediaRequested = false;

async function getMediaStream() {
    if (mediaRequested) return true;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getAudioTracks()[0].enabled = false; localStream.getVideoTracks()[0].enabled = false;
        localVideo.srcObject = localStream; cameraBoxesContainer.classList.remove('hidden');
        mediaRequested = true;
        
        // Update peer connections with new tracks
        for (let userId in peers) {
            localStream.getTracks().forEach(track => {
                const sender = peers[userId].getSenders().find(s => s.track && s.track.kind === track.kind);
                if (!sender) peers[userId].addTrack(track, localStream);
            });
        }
        return true;
    } catch (err) { 
        console.error("Medya cihazlarına erişilemedi:", err); 
        alert("Kamera veya mikrofona erişilemedi. Lütfen tarayıcı izinlerinizi kontrol edin.");
        return false; 
    }
}

function emitMediaState() {
    socket.emit('mediaState', { isMicOn, isCamOn: isCamOn || isScreenSharing, isScreenSharing });
    if (!isCamOn && !isScreenSharing) localCameraBox.classList.add('hidden'); 
    else localCameraBox.classList.remove('hidden');
}

function manageScreenshareView() {
    const mainScreenshare = document.getElementById('main-screenshare');
    const playerDiv = document.getElementById('player');
    
    let sharingUser = null;
    if (isScreenSharing && screenStream) {
        sharingUser = { id: socket.id, stream: screenStream };
    } else {
        for (let userId in currentUsers) {
            if (currentUsers[userId].isScreenSharing) {
                const box = document.getElementById(`camera-${userId}`);
                if (box) {
                    const vid = box.querySelector('video');
                    if (vid && vid.srcObject) {
                        sharingUser = { id: userId, stream: vid.srcObject };
                        box.classList.add('hidden');
                    }
                }
            }
        }
    }

    if (sharingUser) {
        if (mainScreenshare.srcObject !== sharingUser.stream) mainScreenshare.srcObject = sharingUser.stream;
        mainScreenshare.muted = (sharingUser.id === socket.id);
        mainScreenshare.classList.remove('hidden');
        playerDiv.style.visibility = 'hidden'; 
    } else {
        mainScreenshare.srcObject = null;
        mainScreenshare.classList.add('hidden');
        playerDiv.style.visibility = 'visible'; 
    }
}

toggleMicBtn.addEventListener('click', async () => {
    const success = await getMediaStream();
    if (!success) return;
    isMicOn = !isMicOn;
    if (localStream) localStream.getAudioTracks()[0].enabled = isMicOn;
    if (isMicOn) {
        toggleMicBtn.className = 'control-btn'; toggleMicBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    } else {
        toggleMicBtn.className = 'control-btn muted'; toggleMicBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
    emitMediaState();
});

toggleCamBtn.addEventListener('click', async () => {
    if (isScreenSharing) return alert("Ekran paylaşımı açıkken kamera açılamaz!");
    const success = await getMediaStream();
    if (!success) return;
    isCamOn = !isCamOn;
    if (localStream) localStream.getVideoTracks()[0].enabled = isCamOn;
    if (isCamOn) {
        toggleCamBtn.className = 'control-btn'; toggleCamBtn.innerHTML = '<i class="fas fa-video"></i>';
    } else {
        toggleCamBtn.className = 'control-btn camera-off'; toggleCamBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
    }
    localVideo.srcObject = localStream; localVideo.style.display = isCamOn ? 'block' : 'none'; 
    emitMediaState();
});

toggleScreenBtn.addEventListener('click', async () => {
    if (!isScreenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            isScreenSharing = true;
            if (isCamOn) {
                isCamOn = false; localStream.getVideoTracks()[0].enabled = false;
                toggleCamBtn.className = 'control-btn camera-off'; toggleCamBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
            }
            toggleScreenBtn.classList.add('muted'); toggleScreenBtn.innerHTML = '<i class="fas fa-times-circle"></i>'; 
            localVideo.srcObject = screenStream; localVideo.style.display = 'block';

            const screenVideoTrack = screenStream.getVideoTracks()[0];
            const screenAudioTrack = screenStream.getAudioTracks()[0];
            for (let userId in peers) {
                const videoSender = peers[userId].getSenders().find(s => s.track && s.track.kind === 'video');
                if (videoSender) videoSender.replaceTrack(screenVideoTrack);
                
                if (screenAudioTrack) {
                    const audioSender = peers[userId].getSenders().find(s => s.track && s.track.kind === 'audio');
                    if (audioSender) audioSender.replaceTrack(screenAudioTrack);
                }
            }
            emitMediaState();
            manageScreenshareView();
            screenVideoTrack.onended = () => { stopScreenSharing(); };
        } catch (err) { console.error("Ekran paylaşılamadı:", err); }
    } else { stopScreenSharing(); }
});

function stopScreenSharing() {
    if (!isScreenSharing) return;
    isScreenSharing = false;
    if (screenStream) { screenStream.getTracks().forEach(track => track.stop()); screenStream = null; }
    toggleScreenBtn.classList.remove('muted'); toggleScreenBtn.innerHTML = '<i class="fas fa-desktop"></i>';
    localVideo.srcObject = localStream; localVideo.style.display = 'none';

    const camVideoTrack = localStream.getVideoTracks()[0];
    const camAudioTrack = localStream.getAudioTracks()[0];
    for (let userId in peers) {
        const videoSender = peers[userId].getSenders().find(s => s.track && s.track.kind === 'video');
        if (videoSender) videoSender.replaceTrack(camVideoTrack);

        const audioSender = peers[userId].getSenders().find(s => s.track && s.track.kind === 'audio');
        if (audioSender) audioSender.replaceTrack(camAudioTrack);
    }
    emitMediaState();
    manageScreenshareView();
}

participantsBtn.addEventListener('click', (e) => { 
    e.stopPropagation();
    participantsDropdown.classList.toggle('hidden'); 
});

document.addEventListener('click', (e) => {
    if (!participantsDropdown.classList.contains('hidden')) {
        if (!participantsDropdown.contains(e.target) && !participantsBtn.contains(e.target)) {
            participantsDropdown.classList.add('hidden');
        }
    }
});

socket.on('update-users', (usersMap) => {
    currentUsers = usersMap;
    participantsList.innerHTML = ''; const userKeys = Object.keys(usersMap); userCountSpan.innerText = userKeys.length;
    userKeys.forEach(userId => {
        const user = usersMap[userId]; const isMe = userId === socket.id;
        const li = document.createElement('li'); li.className = 'participant-item';
        let actionsHtml = '';
        if (!isMe) {
            const isMuted = locallyMutedUsers.has(userId);
            actionsHtml = `
                <div class="participant-controls">
                    <input type="range" class="remote-vol-slider" data-id="${userId}" min="0" max="100" value="${isMuted ? 0 : 100}" title="Kişisel Ses">
                    <button class="host-action-btn ${isMuted ? 'muted' : ''} mute-remote-btn" data-id="${userId}" title="Sesi Aç/Kapat"><i class="fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i></button>`;
            
            // Host actions
            if (myId === currentHostId) {
                actionsHtml += `
                    <button class="host-action-btn force-off" onclick="socket.emit('forceMute', '${userId}')" title="Kişinin Mikrofonunu Kapat"><i class="fas fa-microphone-slash"></i></button>
                    <button class="host-action-btn force-off" onclick="socket.emit('forceCamOff', '${userId}')" title="Kişinin Kamerasını Kapat"><i class="fas fa-video-slash"></i></button>
                `;
            }
            actionsHtml += `</div>`;
        }
        li.innerHTML = `<div class="participant-header"><span>${user.isHost ? '👑 ' : ''}${user.username} ${isMe ? '(Sen)' : ''}</span></div>${actionsHtml}`;
        participantsList.appendChild(li);

        if (!isMe) {
            const remoteBox = document.getElementById(`camera-${userId}`);
            if (remoteBox) { 
                if (!user.isCamOn) remoteBox.classList.add('hidden'); 
                else remoteBox.classList.remove('hidden'); 
            }
        }
    });

    // Ses Slider Event Listener
    document.querySelectorAll('.remote-vol-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const targetId = e.target.getAttribute('data-id'); 
            const videoElem = document.querySelector(`#camera-${targetId} video`);
            if (videoElem) videoElem.volume = e.target.value / 100;
        });
    });

    // Mevcut Mute Butonu Event Listener
    document.querySelectorAll('.mute-remote-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.mute-remote-btn');
            const targetId = targetBtn.getAttribute('data-id'); 
            const videoElem = document.querySelector(`#camera-${targetId} video`);
            const slider = document.querySelector(`.remote-vol-slider[data-id="${targetId}"]`);
            if (locallyMutedUsers.has(targetId)) {
                locallyMutedUsers.delete(targetId); targetBtn.innerHTML = '<i class="fas fa-volume-up"></i>'; 
                targetBtn.classList.remove('muted');
                if (videoElem) videoElem.muted = false;
                if (slider) slider.value = 100;
            } else {
                locallyMutedUsers.add(targetId); targetBtn.innerHTML = '<i class="fas fa-volume-mute"></i>'; 
                targetBtn.classList.add('muted');
                if (videoElem) videoElem.muted = true;
                if (slider) slider.value = 0;
            }
        });
    });
    
    setTimeout(manageScreenshareView, 200);
});

socket.on('user-joined', (userId) => { peers[userId] = createPeerConnection(userId, true); });
socket.on('signal', async (userId, message) => {
    if (!peers[userId]) peers[userId] = createPeerConnection(userId, false);
    const pc = peers[userId];
    if (message.ice) pc.addIceCandidate(new RTCIceCandidate(message.ice));
    else if (message.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        if (message.sdp.type === 'offer') { const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); socket.emit('signal', userId, { sdp: pc.localDescription }); }
    }
});

function createPeerConnection(userId, isInitiator) {
    const pc = new RTCPeerConnection(configuration);
    if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.onicecandidate = e => { if (e.candidate) socket.emit('signal', userId, { ice: e.candidate }); };
    pc.ontrack = e => addRemoteVideo(userId, e.streams[0]);
    if (isInitiator) { pc.createOffer().then(offer => { pc.setLocalDescription(offer); socket.emit('signal', userId, { sdp: offer }); }); }
    return pc;
}

function addRemoteVideo(userId, stream) {
    if (document.getElementById(`camera-${userId}`)) return;
    const isCamActive = currentUsers[userId] && currentUsers[userId].isCamOn;
    const box = document.createElement('div'); 
    box.className = isCamActive ? 'camera-box' : 'camera-box hidden'; 
    box.id = `camera-${userId}`;
    
    box.style.left = `${Math.random() * 50 + 170}px`; box.style.top = '10px';
    const vid = document.createElement('video'); vid.className = 'remote-video'; vid.autoplay = true; vid.playsInline = true; vid.srcObject = stream;
    if (locallyMutedUsers.has(userId)) vid.muted = true;
    box.appendChild(vid); cameraBoxesContainer.appendChild(box);
    setTimeout(manageScreenshareView, 100);
}

socket.on('user-left', (userId) => {
    if (peers[userId]) { peers[userId].close(); delete peers[userId]; }
    const box = document.getElementById(`camera-${userId}`); if (box) box.remove();
    locallyMutedUsers.delete(userId);
    manageScreenshareView();
});

window.addEventListener('load', getMediaStream);

// --- TAM EKRAN MANTIĞI ---
if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => console.log(err)); } 
        else { document.exitFullscreen(); }
    });
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        else fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    });
}

// --- HEADER GİZLEME VE MOBİL YATAY MANTIĞI ---
const headerToggleBtn = document.getElementById('header-toggle-btn');
const mainHeader = document.getElementById('main-header');

headerToggleBtn.addEventListener('click', () => {
    mainHeader.classList.toggle('collapsed');
    if (mainHeader.classList.contains('collapsed')) {
        headerToggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        if (window.innerWidth <= 768) chatPanel.classList.add('chat-closed');
    } else {
        headerToggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    }
});

function handleOrientationChange() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const isMobile = window.innerWidth <= 950; 
    if (isLandscape && isMobile) {
        if (!mainHeader.classList.contains('collapsed')) { mainHeader.classList.add('collapsed'); headerToggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>'; }
        if (!chatPanel.classList.contains('chat-closed')) chatPanel.classList.add('chat-closed');
    } else if (!isLandscape && isMobile) {
        if (mainHeader.classList.contains('collapsed')) { mainHeader.classList.remove('collapsed'); headerToggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>'; }
    }
}
window.addEventListener('resize', handleOrientationChange);
window.addEventListener('orientationchange', handleOrientationChange);
handleOrientationChange();

// --- SÜRÜKLE BIRAK MANTIĞI ---
let isDragging = false; let currentBox = null; let offsetX = 0, offsetY = 0;
function getEventPos(e) { return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }; }

function startDrag(e) {
    const box = e.target.closest('.camera-box'); if (!box) return;
    const rect = box.getBoundingClientRect(); const pos = getEventPos(e);
    if (pos.x >= rect.right - 20 && pos.y >= rect.bottom - 20) return; 

    e.preventDefault(); isDragging = true; currentBox = box;
    const parentRect = cameraBoxesContainer.getBoundingClientRect();
    offsetX = pos.x - parentRect.left - parseInt(box.style.left || 0); offsetY = pos.y - parentRect.top - parseInt(box.style.top || 0);
    box.style.cursor = 'grabbing'; document.querySelector('.player-wrapper').style.pointerEvents = 'none'; 
}

function drag(e) {
    if (!isDragging || !currentBox) return;
    const pos = getEventPos(e); const parentRect = cameraBoxesContainer.getBoundingClientRect();
    currentBox.style.left = `${pos.x - parentRect.left - offsetX}px`; currentBox.style.top = `${pos.y - parentRect.top - offsetY}px`;
}

function stopDrag() {
    if (isDragging && currentBox) {
        currentBox.style.cursor = 'grab'; document.querySelector('.player-wrapper').style.pointerEvents = 'auto';
        isDragging = false; currentBox = null;
    }
}

document.addEventListener('mousedown', startDrag); document.addEventListener('mousemove', drag); document.addEventListener('mouseup', stopDrag);
document.addEventListener('touchstart', startDrag, {passive: false}); document.addEventListener('touchmove', drag, {passive: false}); document.addEventListener('touchend', stopDrag);

// --- DRAGGABLE CHAT BUBBLE ---
let isDraggingChat = false;
let dragStartX = 0;
let dragStartY = 0;
let currentRight = 20; 
let currentBottom = 75;

chatToggleBtn.addEventListener("mousedown", startDragChat);
chatToggleBtn.addEventListener("touchstart", startDragChat, {passive: false});

function startDragChat(e) {
    if (e.target.closest("#chat-toggle-btn") !== chatToggleBtn) return;
    isDraggingChat = true;
    dragHasMovedChat = false;
    dragStartX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    dragStartY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
    
    const rect = chatToggleBtn.getBoundingClientRect();
    currentRight = window.innerWidth - rect.right;
    currentBottom = window.innerHeight - rect.bottom;
    chatToggleBtn.style.transition = 'none'; // REMOVE TRANSITION FOR SMOOTH DRAG
    
    document.addEventListener("mousemove", dragChat);
    document.addEventListener("touchmove", dragChat, {passive: false});
    document.addEventListener("mouseup", endDragChat);
    document.addEventListener("touchend", endDragChat);
}

function dragChat(e) {
    if (!isDraggingChat) return;
    const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes("mouse") ? e.clientY : e.touches[0].clientY;
    
    const deltaX = dragStartX - clientX;
    const deltaY = dragStartY - clientY;
    
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragHasMovedChat = true;
        if(e.cancelable) e.preventDefault();
    }
    
    dragStartX = clientX;
    dragStartY = clientY;
    
    currentRight += deltaX;
    currentBottom += deltaY;
    
    currentRight = Math.max(10, Math.min(window.innerWidth - 70, currentRight));
    currentBottom = Math.max(10, Math.min(window.innerHeight - 70, currentBottom));
    
    chatToggleBtn.style.right = `${currentRight}px`;
    chatToggleBtn.style.bottom = `${currentBottom}px`;
    
    chatPanel.style.bottom = `${currentBottom + 70}px`;
    if (currentRight > window.innerWidth / 2) {
        const leftPos = window.innerWidth - currentRight - 60;
        chatPanel.style.right = "auto";
        chatPanel.style.left = `${Math.max(10, leftPos)}px`;
    } else {
        chatPanel.style.left = "auto";
        chatPanel.style.right = `${currentRight}px`;
    }
}

function endDragChat() {
    isDraggingChat = false;
    chatToggleBtn.style.transition = '0.3s'; // RESTORE TRANSITION
    document.removeEventListener("mousemove", dragChat);
    document.removeEventListener("touchmove", dragChat);
    document.removeEventListener("mouseup", endDragChat);
    document.removeEventListener("touchend", endDragChat);
}


// --- REACTIONS ---
const emojiToggleBtn = document.getElementById('emoji-toggle-btn');
const emojiPickerMenu = document.getElementById('emoji-picker-menu');
if (emojiToggleBtn) {
    emojiToggleBtn.addEventListener('click', () => {
        emojiPickerMenu.classList.toggle('hidden');
        emojiToggleBtn.style.color = emojiPickerMenu.classList.contains('hidden') ? '#555' : '#00CED1';
    });
}

function sendReaction(emoji) { 
    socket.emit('reaction', emoji); 
    if(emojiPickerMenu) {
        emojiPickerMenu.classList.add('hidden');
        emojiToggleBtn.style.color = '#555';
    }
}
socket.on('reaction', (data) => {
    const chatSection = document.querySelector('.chat-section');
    if (!chatSection) return;
    const el = document.createElement('div');
    el.className = 'flying-emoji';
    el.innerText = data.emoji;
    el.style.left = Math.random() * 60 + 20 + '%';
    el.style.bottom = '10px';
    chatSection.appendChild(el);
    setTimeout(() => { if(el.parentNode) el.parentNode.removeChild(el); }, 3000);
});


// HOST ACTIONS & EVENTS
const roomControlBtn = document.getElementById('room-control-btn');
if (roomControlBtn) {
    roomControlBtn.addEventListener('click', () => {
        socket.emit('toggleFreeControl');
    });
}

socket.on("roomControlChanged", (free) => {
    isFreeControl = free;
    updateVideoControlsUI();
});

socket.on("hostChanged", (newHostId) => {
    currentHostId = newHostId;
    myId = socket.id;
    updateVideoControlsUI();
});

socket.on("forceMute", () => {
    if (isMicOn) {
        document.getElementById("toggle-mic-btn").click();
    }
});

socket.on("forceCamOff", () => {
    if (isCamOn) {
        document.getElementById("toggle-cam-btn").click();
    }
});

