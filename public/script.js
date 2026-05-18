const socket = io();

// UI Elementleri
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('join-btn');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const ytUrlInput = document.getElementById('youtube-url');
const loadBtn = document.getElementById('load-btn');

let player;
let isUserAction = true; // Kısır döngüleri engellemek için

// --- SOHBET VE GİRİŞ ---
joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        socket.emit('join', username);
        loginScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
    }
});

sendBtn.addEventListener('click', () => {
    const msg = msgInput.value.trim();
    if (msg) {
        socket.emit('chatMessage', msg);
        msgInput.value = '';
    }
});

socket.on('message', (data) => {
    const div = document.createElement('div');
    div.classList.add('message');
    div.style.borderLeftColor = data.color;
    div.innerHTML = `<div class="user" style="color: ${data.color}">${data.user}</div><div>${data.text}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Enter tuş destekleri
usernameInput.addEventListener('keypress', e => e.key === 'Enter' && joinBtn.click());
msgInput.addEventListener('keypress', e => e.key === 'Enter' && sendBtn.click());

// --- YOUTUBE VİDEO KONTROLLERİ ---
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: { 'autoplay': 0, 'controls': 1 },
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (!isUserAction) return;

    if (event.data == YT.PlayerState.PLAYING) {
        socket.emit('playVideo', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.PAUSED) {
        socket.emit('pauseVideo', player.getCurrentTime());
    }
}

// Link yükleme
loadBtn.addEventListener('click', () => {
    const url = ytUrlInput.value;
    const videoId = extractVideoID(url);
    if (videoId) {
        socket.emit('loadVideo', videoId);
        ytUrlInput.value = '';
    } else {
        alert("Geçerli bir YouTube linki girin!");
    }
});

function extractVideoID(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Sunucudan gelen video komutları
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