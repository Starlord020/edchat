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

let player;
let isUserAction = true;
let currentRoomId = null;

// URL KONTROLÜ
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('oda');

if (roomParam) {
    currentRoomId = roomParam;
    passwordScreen.classList.remove('hidden');
} else {
    createScreen.classList.remove('hidden');
}

function appendMessage(data) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.style.borderLeftColor = data.color;
    div.innerHTML = `<div class="user" style="color: ${data.color}">${data.user}</div><div>${data.text}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

createBtn.addEventListener('click', () => {
    const pass = newRoomPassInput.value.trim();
    if (!pass) return alert("Lütfen oda için bir şifre belirleyin!");
    socket.emit('createRoom', pass, (roomId) => {
        window.location.href = `?oda=${roomId}`;
    });
});

joinBtn.addEventListener('click', () => {
    const username = joinUsername.value.trim();
    const password = joinPassword.value.trim();

    if (!username || !password) return alert("Kullanıcı adı ve şifre zorunludur!");

    socket.emit('joinRoom', { roomId: currentRoomId, password, username }, (response) => {
        if (response.success) {
            passwordScreen.classList.add('hidden');
            mainScreen.classList.remove('hidden');
            
            chatMessages.innerHTML = ''; 
            if (response.messages) response.messages.forEach(msg => appendMessage(msg));

            if (player && player.loadVideoById) {
                isUserAction = false;
                if (response.isPlaying) player.loadVideoById(response.videoId, response.time);
                else player.cueVideoById(response.videoId, response.time);
                setTimeout(() => isUserAction = true, 1000);
            }
        } else {
            alert(response.message);
        }
    });
});

copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    copyLinkBtn.innerText = "Kopyalandı!";
    setTimeout(() => { copyLinkBtn.innerText = "Davet Linkini Kopyala"; }, 2000);
});

sendBtn.addEventListener('click', () => {
    const msg = msgInput.value.trim();
    if (msg) { socket.emit('chatMessage', msg); msgInput.value = ''; }
});
msgInput.addEventListener('keypress', e => e.key === 'Enter' && sendBtn.click());
socket.on('message', appendMessage);

// YOUTUBE
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%', width: '100%', videoId: '',
        playerVars: { 'autoplay': 0, 'controls': 1 },
        events: { 'onStateChange': onPlayerStateChange }
    });
}
function onPlayerStateChange(event) {
    if (!isUserAction) return;
    if (event.data == YT.PlayerState.PLAYING) socket.emit('playVideo', player.getCurrentTime());
    else if (event.data == YT.PlayerState.PAUSED) socket.emit('pauseVideo', player.getCurrentTime());
}
loadBtn.addEventListener('click', () => {
    const url = ytUrlInput.value;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    const videoId = (match && match[2].length === 11) ? match[2] : null;
    if (videoId) { socket.emit('loadVideo', videoId); ytUrlInput.value = ''; } 
    else alert("Geçerli bir YouTube linki girin!");
});
socket.on('videoChange', (videoId) => {
    if(player && player.loadVideoById) {
        isUserAction = false; player.loadVideoById(videoId);
        setTimeout(() => isUserAction = true, 1000);
    }
});
socket.on('videoPlay', (time) => {
    if(player && player.playVideo) {
        isUserAction = false;
        if (Math.abs(player.getCurrentTime() - time) > 2) player.seekTo(time);
        player.playVideo(); setTimeout(() => isUserAction = true, 500);
    }
});
socket.on('videoPause', () => {
    if(player && player.pauseVideo) {
        isUserAction = false; player.pauseVideo();
        setTimeout(() => isUserAction = true, 500);
    }
});

// --- YENİ: GERÇEK WEBRTC GÖRÜNTÜ VE SES AKTARIMI ---
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const cameraBoxesContainer = document.getElementById('camera-boxes-container');
const localVideo = document.getElementById('local-video');

let localStream = null;
let isMicOn = false;
let isCamOn = false;
const peers = {}; // Diğer kullanıcılara olan bağlantıları tutar

// Google'ın ücretsiz bağlantı sunucuları
const configuration = { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] };

async function getMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getAudioTracks()[0].enabled = false;
        localStream.getVideoTracks()[0].enabled = false;
        localVideo.srcObject = localStream;
        cameraBoxesContainer.classList.remove('hidden');
    } catch (err) {
        console.error("Medya cihazlarına erişilemedi:", err);
    }
}

// Buton Kontrolleri
toggleMicBtn.addEventListener('click', () => {
    if (!localStream) return;
    isMicOn = !isMicOn;
    localStream.getAudioTracks()[0].enabled = isMicOn;
    toggleMicBtn.className = isMicOn ? 'control-btn' : 'control-btn muted';
    toggleMicBtn.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
});

toggleCamBtn.addEventListener('click', () => {
    if (!localStream) return;
    isCamOn = !isCamOn;
    localStream.getVideoTracks()[0].enabled = isCamOn;
    toggleCamBtn.className = isCamOn ? 'control-btn' : 'control-btn camera-off';
    toggleCamBtn.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    localVideo.style.display = isCamOn ? 'block' : 'none';
});

// Biri odaya katıldığında onu ara
socket.on('user-joined', (userId) => {
    const pc = createPeerConnection(userId, true);
    peers[userId] = pc;
});

// Gelen WebRTC Sinyallerini İşle
socket.on('signal', async (userId, message) => {
    if (!peers[userId]) {
        peers[userId] = createPeerConnection(userId, false);
    }
    const pc = peers[userId];

    if (message.ice) {
        pc.addIceCandidate(new RTCIceCandidate(message.ice));
    } else if (message.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        if (message.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('signal', userId, { sdp: pc.localDescription });
        }
    }
});

// P2P Bağlantısı Oluştur
function createPeerConnection(userId, isInitiator) {
    const pc = new RTCPeerConnection(configuration);
    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    
    pc.onicecandidate = event => {
        if (event.candidate) socket.emit('signal', userId, { ice: event.candidate });
    };

    pc.ontrack = event => {
        addRemoteVideo(userId, event.streams[0]);
    };

    if (isInitiator) {
        pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            socket.emit('signal', userId, { sdp: offer });
        });
    }
    return pc;
}

// Yeni gelen kişinin kamerasını ekrana ekle
function addRemoteVideo(userId, stream) {
    if (document.getElementById(`camera-${userId}`)) return;

    const box = document.createElement('div');
    box.className = 'camera-box';
    box.id = `camera-${userId}`;
    // Yeni kutuları yerel kutunun sağına dizmek için rastgele başlangıç
    box.style.left = `${Math.random() * 50 + 170}px`; 
    box.style.top = '10px';

    const vid = document.createElement('video');
    vid.className = 'remote-video';
    vid.autoplay = true;
    vid.playsInline = true;
    vid.srcObject = stream;
    vid.style.display = 'block';

    box.appendChild(vid);
    cameraBoxesContainer.appendChild(box);
}

// Biri çıkınca kamerasını sil
socket.on('user-left', (userId) => {
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }
    const box = document.getElementById(`camera-${userId}`);
    if (box) box.remove();
});

window.addEventListener('load', getMediaStream);

// --- YENİ: SÜRÜKLE BIRAK (Mobil ve Metin Seçme Hatası Çözüldü) ---
let isDragging = false;
let currentBox = null;
let offsetX = 0, offsetY = 0;

function getEventPos(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
}

function startDrag(e) {
    const box = e.target.closest('.camera-box');
    if (!box) return;
    
    // Sağ alt köşeden (boyutlandırma) tutulup tutulmadığını kontrol et
    const rect = box.getBoundingClientRect();
    const pos = getEventPos(e);
    if (pos.x >= rect.right - 20 && pos.y >= rect.bottom - 20) return; // Boyutlandırmaya izin ver

    e.preventDefault(); // MAVİ SEÇME HATASINI ENGELLER
    isDragging = true;
    currentBox = box;
    
    const parentRect = cameraBoxesContainer.getBoundingClientRect();
    offsetX = pos.x - parentRect.left - parseInt(box.style.left || 0);
    offsetY = pos.y - parentRect.top - parseInt(box.style.top || 0);
    
    box.style.cursor = 'grabbing';
    document.querySelector('.player-wrapper').style.pointerEvents = 'none'; 
}

function drag(e) {
    if (!isDragging || !currentBox) return;
    const pos = getEventPos(e);
    const parentRect = cameraBoxesContainer.getBoundingClientRect();
    
    let newX = pos.x - parentRect.left - offsetX;
    let newY = pos.y - parentRect.top - offsetY;

    currentBox.style.left = `${newX}px`;
    currentBox.style.top = `${newY}px`;
}

function stopDrag() {
    if (isDragging && currentBox) {
        currentBox.style.cursor = 'grab';
        document.querySelector('.player-wrapper').style.pointerEvents = 'auto';
        isDragging = false;
        currentBox = null;
    }
}

// Hem fare hem dokunmatik (mobil) için olaylar
document.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);

document.addEventListener('touchstart', startDrag, {passive: false});
document.addEventListener('touchmove', drag, {passive: false});
document.addEventListener('touchend', stopDrag);