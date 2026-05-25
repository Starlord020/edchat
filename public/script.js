const socket = io();

// UI Elements
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
const copyLinkBtn = document.getElementById('copy-link-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');

// Search & W2G UI
const searchInput = document.getElementById('youtube-search-input');
const searchBtn = document.getElementById('search-btn');
const searchDropdown = document.getElementById('search-results-dropdown');
const playlistContainer = document.getElementById('playlist-container');
const historyContainer = document.getElementById('history-container');
const tabPlaylist = document.getElementById('tab-playlist');
const tabHistory = document.getElementById('tab-history');
const hostBadge = document.getElementById('host-badge');
const toggleLockBtn = document.getElementById('toggle-lock-btn');

let player; let isUserAction = true; let currentRoomId = null;
let myUserId = null; let currentHostId = null; let isLocked = false;

const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('oda');
if (roomParam) { currentRoomId = roomParam; passwordScreen.classList.remove('hidden'); } 
else { createScreen.classList.remove('hidden'); }

function appendMessage(data) {
    const div = document.createElement('div');
    div.classList.add('message'); div.style.borderLeftColor = data.color;
    div.innerHTML = `<div class="user" style="color: ${data.color}">${data.user}</div><div>${data.text}</div>`;
    chatMessages.appendChild(div); chatMessages.scrollTop = chatMessages.scrollHeight;
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
            passwordScreen.classList.add('hidden'); mainScreen.classList.remove('hidden');
            chatMessages.innerHTML = ''; 
            if (response.messages) response.messages.forEach(msg => appendMessage(msg));
            
            myUserId = socket.id;
            updateHostStatus(response.hostId, response.locked);
            renderPlaylist(response.playlist);
            renderHistory(response.history);

            if (player && player.loadVideoById) {
                isUserAction = false;
                if (response.isPlaying) player.loadVideoById(response.videoId, response.time);
                else player.cueVideoById(response.videoId, response.time);
                setTimeout(() => isUserAction = true, 1000);
            }
        } else alert(response.message);
    });
});

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

// W2G: Tabs
tabPlaylist.addEventListener('click', () => {
    tabPlaylist.classList.add('active'); tabHistory.classList.remove('active');
    playlistContainer.classList.remove('hidden'); historyContainer.classList.add('hidden');
});
tabHistory.addEventListener('click', () => {
    tabHistory.classList.add('active'); tabPlaylist.classList.remove('active');
    historyContainer.classList.remove('hidden'); playlistContainer.classList.add('hidden');
});

// W2G: Search
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (!query) { searchDropdown.classList.add('hidden'); return; }
    
    // Check if it's a direct youtube link
    const match = query.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    if (match && match[2].length === 11) {
        // Automatically add to queue
        socket.emit('addToPlaylist', { id: match[2], title: 'Link ile Eklendi', author: '', image: `https://img.youtube.com/vi/${match[2]}/mqdefault.jpg` });
        searchInput.value = '';
        return;
    }

    searchTimeout = setTimeout(() => {
        socket.emit('searchVideo', query, (res) => {
            if (res.success && res.videos.length > 0) {
                searchDropdown.innerHTML = '';
                res.videos.forEach(v => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = `
                        <img src="${v.image}" alt="">
                        <div class="search-result-info">
                            <div class="search-result-title">${v.title}</div>
                            <div class="search-result-author">${v.author} • ${v.duration}</div>
                        </div>
                        <button class="add-to-queue-btn">Sıraya Ekle</button>
                    `;
                    item.querySelector('.add-to-queue-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        socket.emit('addToPlaylist', v);
                        searchDropdown.classList.add('hidden');
                        searchInput.value = '';
                    });
                    item.addEventListener('click', () => {
                        socket.emit('addToPlaylist', v);
                        searchDropdown.classList.add('hidden');
                        searchInput.value = '';
                    });
                    searchDropdown.appendChild(item);
                });
                searchDropdown.classList.remove('hidden');
            }
        });
    }, 500);
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.w2g-search-header')) {
        searchDropdown.classList.add('hidden');
    }
});

// W2G: Host & Lock
function updateHostStatus(hostId, locked) {
    currentHostId = hostId;
    isLocked = locked;
    const isMeHost = (socket.id === hostId);
    
    if (isMeHost) {
        hostBadge.classList.remove('hidden');
        toggleLockBtn.classList.remove('hidden');
        toggleLockBtn.innerHTML = isLocked ? '<i class="fas fa-lock"></i>' : '<i class="fas fa-unlock"></i>';
        toggleLockBtn.classList.toggle('muted', isLocked);
    } else {
        hostBadge.classList.add('hidden');
        toggleLockBtn.classList.add('hidden');
    }
}

toggleLockBtn.addEventListener('click', () => {
    socket.emit('toggleLock');
});

socket.on('hostChanged', (newHostId) => { updateHostStatus(newHostId, isLocked); });
socket.on('lockStatusChanged', (locked) => { updateHostStatus(currentHostId, locked); });

// W2G: Playlist & History UI
function renderPlaylist(playlist) {
    playlistContainer.innerHTML = '';
    playlist.forEach((v, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.innerHTML = `
            <img src="${v.image || `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}">
            <div class="playlist-item-info">
                <div class="playlist-item-title">${v.title}</div>
                <div class="playlist-item-author">${v.author || ''}</div>
            </div>
        `;
        if (socket.id === currentHostId || !isLocked) {
            const btn = document.createElement('button');
            btn.className = 'remove-playlist-btn';
            btn.innerHTML = '<i class="fas fa-times"></i>';
            btn.onclick = () => socket.emit('removeFromPlaylist', index);
            item.appendChild(btn);
        }
        playlistContainer.appendChild(item);
    });
}

function renderHistory(history) {
    historyContainer.innerHTML = '';
    history.forEach(v => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.style.opacity = '0.6';
        item.innerHTML = `
            <img src="https://img.youtube.com/vi/${v.id}/mqdefault.jpg">
            <div class="playlist-item-info">
                <div class="playlist-item-title">Video ID: ${v.id}</div>
            </div>
            <button class="add-to-queue-btn" title="Tekrar Çal" style="position: absolute; right: 10px; top: 15px;"><i class="fas fa-redo"></i></button>
        `;
        item.querySelector('.add-to-queue-btn').onclick = () => socket.emit('addToPlaylist', {id: v.id, title: 'Geçmişten Eklendi', image: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`});
        historyContainer.appendChild(item);
    });
}

socket.on('playlistUpdated', renderPlaylist);
socket.on('historyUpdated', renderHistory);


// YOUTUBE PLAYER CONTROLS
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', { height: '100%', width: '100%', videoId: '', playerVars: { 'autoplay': 0, 'controls': 1 }, events: { 'onStateChange': onPlayerStateChange } });
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.ENDED) {
        if (socket.id === currentHostId || !isLocked) {
            socket.emit('playNext');
        }
    }
    if (!isUserAction) return;
    if (event.data == YT.PlayerState.PLAYING) socket.emit('playVideo', player.getCurrentTime());
    else if (event.data == YT.PlayerState.PAUSED) socket.emit('pauseVideo', player.getCurrentTime());
}

socket.on('videoChange', (videoId) => { 
    if(player && player.loadVideoById) { 
        isUserAction = false; 
        if(videoId) {
            player.loadVideoById(videoId); 
        } else {
            player.stopVideo(); // Stop if empty queue
        }
        setTimeout(() => isUserAction = true, 1000); 
    } 
});
socket.on('videoPlay', (time) => { if(player && player.playVideo) { isUserAction = false; if (Math.abs(player.getCurrentTime() - time) > 2) player.seekTo(time); player.playVideo(); setTimeout(() => isUserAction = true, 500); } });
socket.on('videoPause', () => { if(player && player.pauseVideo) { isUserAction = false; player.pauseVideo(); setTimeout(() => isUserAction = true, 500); } });


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

async function getMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getAudioTracks()[0].enabled = false; localStream.getVideoTracks()[0].enabled = false;
        localVideo.srcObject = localStream; cameraBoxesContainer.classList.remove('hidden');
    } catch (err) { console.error("Medya cihazlarına erişilemedi:", err); }
}

function emitMediaState() {
    socket.emit('mediaState', { isMicOn, isCamOn: isCamOn || isScreenSharing });
    if (!isCamOn && !isScreenSharing) localCameraBox.classList.add('hidden'); 
    else localCameraBox.classList.remove('hidden');
}

toggleMicBtn.addEventListener('click', () => {
    if (!localStream) return; isMicOn = !isMicOn; localStream.getAudioTracks()[0].enabled = isMicOn;
    toggleMicBtn.className = isMicOn ? 'control-btn' : 'control-btn muted';
    toggleMicBtn.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    emitMediaState();
});

toggleCamBtn.addEventListener('click', () => {
    if (!localStream) return; 
    if (isScreenSharing) stopScreenSharing();
    isCamOn = !isCamOn; localStream.getVideoTracks()[0].enabled = isCamOn;
    toggleCamBtn.className = isCamOn ? 'control-btn' : 'control-btn camera-off';
    toggleCamBtn.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    localVideo.srcObject = localStream; localVideo.style.display = isCamOn ? 'block' : 'none'; 
    emitMediaState();
});

toggleScreenBtn.addEventListener('click', async () => {
    if (!isScreenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            isScreenSharing = true;
            if (isCamOn) {
                isCamOn = false; localStream.getVideoTracks()[0].enabled = false;
                toggleCamBtn.className = 'control-btn camera-off'; toggleCamBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
            }
            toggleScreenBtn.classList.add('muted'); toggleScreenBtn.innerHTML = '<i class="fas fa-times-circle"></i>'; 
            localVideo.srcObject = screenStream; localVideo.style.display = 'block';

            const screenTrack = screenStream.getVideoTracks()[0];
            for (let userId in peers) {
                const sender = peers[userId].getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            }
            emitMediaState();
            screenTrack.onended = () => { stopScreenSharing(); };
        } catch (err) { console.error("Ekran paylaşılamadı:", err); }
    } else { stopScreenSharing(); }
});

function stopScreenSharing() {
    if (!isScreenSharing) return;
    isScreenSharing = false;
    if (screenStream) { screenStream.getTracks().forEach(track => track.stop()); screenStream = null; }
    toggleScreenBtn.classList.remove('muted'); toggleScreenBtn.innerHTML = '<i class="fas fa-desktop"></i>';
    localVideo.srcObject = localStream; localVideo.style.display = 'none';

    const camTrack = localStream.getVideoTracks()[0];
    for (let userId in peers) {
        const sender = peers[userId].getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(camTrack);
    }
    emitMediaState();
}

participantsBtn.addEventListener('click', () => { participantsDropdown.classList.toggle('hidden'); });

socket.on('update-users', (usersMap) => {
    currentUsers = usersMap;
    participantsList.innerHTML = ''; const userKeys = Object.keys(usersMap); userCountSpan.innerText = userKeys.length;
    userKeys.forEach(userId => {
        const user = usersMap[userId]; const isMe = userId === socket.id;
        const li = document.createElement('li'); li.className = 'participant-item';
        let actionsHtml = '';
        if (!isMe) {
            const isMuted = locallyMutedUsers.has(userId);
            actionsHtml = `<i class="fas ${isMuted ? 'fa-volume-mute muted' : 'fa-volume-up'} mute-remote-btn" data-id="${userId}" title="Sesi Aç/Kapat"></i>`;
        }
        
        let hostIcon = (userId === currentHostId) ? '<i class="fas fa-crown" style="color:gold; margin-left:5px;"></i>' : '';
        
        // Host can set others as host
        if (!isMe && socket.id === currentHostId) {
            actionsHtml += `<button class="outline-btn" style="padding: 2px 5px; height: auto; margin-left: 10px;" onclick="socket.emit('setHost', '${userId}')">Host Yap</button>`;
        }

        li.innerHTML = `<span>${user.username} ${isMe ? '(Sen)' : ''} ${hostIcon}</span><div class="participant-actions" style="display:flex; align-items:center;">${actionsHtml}</div>`;
        participantsList.appendChild(li);

        if (!isMe) {
            const remoteBox = document.getElementById(`camera-${userId}`);
            if (remoteBox) { 
                if (!user.isCamOn) remoteBox.classList.add('hidden'); 
                else remoteBox.classList.remove('hidden'); 
            }
        }
    });

    document.querySelectorAll('.mute-remote-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-id'); const videoElem = document.querySelector(`#camera-${targetId} video`);
            if (locallyMutedUsers.has(targetId)) {
                locallyMutedUsers.delete(targetId); e.target.className = 'fas fa-volume-up mute-remote-btn'; if (videoElem) videoElem.muted = false;
            } else {
                locallyMutedUsers.add(targetId); e.target.className = 'fas fa-volume-mute mute-remote-btn muted'; if (videoElem) videoElem.muted = true;
            }
        });
    });
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
}

socket.on('user-left', (userId) => {
    if (peers[userId]) { peers[userId].close(); delete peers[userId]; }
    const box = document.getElementById(`camera-${userId}`); if (box) box.remove();
    locallyMutedUsers.delete(userId);
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
    } else {
        headerToggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    }
});

function handleOrientationChange() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const isMobile = window.innerWidth <= 950; 
    if (isLandscape && isMobile) {
        if (!mainHeader.classList.contains('collapsed')) { mainHeader.classList.add('collapsed'); headerToggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>'; }
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