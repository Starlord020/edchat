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

// --- URL KONTROLÜ ---
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('oda');

if (roomParam) {
    currentRoomId = roomParam;
    passwordScreen.classList.remove('hidden');
} else {
    createScreen.classList.remove('hidden');
}

// --- MESAJ YAZDIRMA ---
function appendMessage(data) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.style.borderLeftColor = data.color;
    div.innerHTML = `<div class="user" style="color: ${data.color}">${data.user}</div><div>${data.text}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- ODA KURMA ---
createBtn.addEventListener('click', () => {
    const pass = newRoomPassInput.value.trim();
    if (!pass) return alert("Lütfen oda için bir şifre belirleyin!");

    socket.emit('createRoom', pass, (roomId) => {
        window.location.href = `?oda=${roomId}`;
    });
});

// --- ODAYA GİRME VE SENKRONİZASYON ---
joinBtn.addEventListener('click', () => {
    const username = joinUsername.value.trim();
    const password = joinPassword.value.trim();

    if (!username || !password) return alert("Kullanıcı adı ve şifre zorunludur!");

    socket.emit('joinRoom', { roomId: currentRoomId, password, username }, (response) => {
        if (response.success) {
            passwordScreen.classList.add('hidden');
            mainScreen.classList.remove('hidden');
            
            chatMessages.innerHTML = ''; 
            if (response.messages) {
                response.messages.forEach(msg => appendMessage(msg));
            }

            if (player && player.loadVideoById) {
                isUserAction = false;
                if (response.isPlaying) {
                    player.loadVideoById(response.videoId, response.time);
                } else {
                    player.cueVideoById(response.videoId, response.time);
                }
                setTimeout(() => isUserAction = true, 1000);
            }
        } else {
            alert(response.message);
        }
    });
});

// --- LİNK KOPYALAMA ---
copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    copyLinkBtn.innerText = "Kopyalandı!";
    setTimeout(() => { copyLinkBtn.innerText = "Davet Linkini Kopyala"; }, 2000);
});

// --- SOHBET ---
sendBtn.addEventListener('click', () => {
    const msg = msgInput.value.trim();
    if (msg) {
        socket.emit('chatMessage', msg);
        msgInput.value = '';
    }
});
msgInput.addEventListener('keypress', e => e.key === 'Enter' && sendBtn.click());
socket.on('message', appendMessage);

// --- YOUTUBE KONTROLLERİ ---
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
    const videoId = extractVideoID(url);
    if (videoId) { socket.emit('loadVideo', videoId); ytUrlInput.value = ''; } 
    else alert("Geçerli bir YouTube linki girin!");
});

function extractVideoID(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

socket.on('videoChange', (videoId) => {
    if(player && player.loadVideoById) {
        isUserAction = false;
        player.loadVideoById(videoId);
        setTimeout(() => isUserAction = true, 1000);
    }
});

socket.on('videoPlay', (time) => {
    if(player && player.playVideo) {
        isUserAction = false;
        if (Math.abs(player.getCurrentTime() - time) > 2) player.seekTo(time);
        player.playVideo();
        setTimeout(() => isUserAction = true, 500);
    }
});

socket.on('videoPause', () => {
    if(player && player.pauseVideo) {
        isUserAction = false;
        player.pauseVideo();
        setTimeout(() => isUserAction = true, 500);
    }
});

// --- MEDYA (KAMERA/MİKROFON) ---
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const localVideo = document.getElementById('local-video');
const cameraPlaceholder = document.querySelector('.camera-placeholder');

let localStream = null;
let isMicOn = false;
let isCamOn = false;

async function getMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getAudioTracks()[0].enabled = false;
        localStream.getVideoTracks()[0].enabled = false;
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Medya cihazlarına erişilemedi:", err);
    }
}

toggleMicBtn.addEventListener('click', () => {
    if (!localStream) return;
    isMicOn = !isMicOn;
    localStream.getAudioTracks()[0].enabled = isMicOn;
    if (isMicOn) {
        toggleMicBtn.classList.remove('muted');
        toggleMicBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    } else {
        toggleMicBtn.classList.add('muted');
        toggleMicBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
});

toggleCamBtn.addEventListener('click', () => {
    if (!localStream) return;
    isCamOn = !isCamOn;
    localStream.getVideoTracks()[0].enabled = isCamOn;
    if (isCamOn) {
        toggleCamBtn.classList.remove('camera-off');
        toggleCamBtn.innerHTML = '<i class="fas fa-video"></i>';
        localVideo.style.display = 'block';
        cameraPlaceholder.style.display = 'none';
    } else {
        toggleCamBtn.classList.add('camera-off');
        toggleCamBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
        localVideo.style.display = 'none';
        cameraPlaceholder.style.display = 'block';
    }
});

window.addEventListener('load', getMediaStream);

// --- SÜRÜKLE & BIRAK (KAMERA) ---
const draggableCam = document.getElementById('draggable-cam');
const playerWrapper = document.querySelector('.player-wrapper');
let isDragging = false;
let offsetX = 0;
let offsetY = 0;

draggableCam.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - draggableCam.getBoundingClientRect().left;
    offsetY = e.clientY - draggableCam.getBoundingClientRect().top;
    draggableCam.style.cursor = 'grabbing';
    playerWrapper.style.pointerEvents = 'none'; 
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const parentRect = draggableCam.parentElement.getBoundingClientRect();
    let newX = e.clientX - parentRect.left - offsetX;
    let newY = e.clientY - parentRect.top - offsetY;
    draggableCam.style.left = `${newX}px`;
    draggableCam.style.top = `${newY}px`;
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        draggableCam.style.cursor = 'grab';
        playerWrapper.style.pointerEvents = 'auto';
    }
});