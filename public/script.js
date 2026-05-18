const socket = io();

// UI Elementleri
const createScreen = document.getElementById('create-screen');
const passwordScreen = document.getElementById('password-screen');
const mainScreen = document.getElementById('main-screen');

// Oda Kurma
const newRoomPassInput = document.getElementById('new-room-pass');
const createBtn = document.getElementById('create-btn');

// Odaya Girme (Şifre Ekranı)
const joinUsername = document.getElementById('join-username');
const joinPassword = document.getElementById('join-password');
const joinBtn = document.getElementById('join-btn');

// Chat ve Video
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
    // Linkle gelmiş, Şifre ekranını göster
    currentRoomId = roomParam;
    passwordScreen.classList.remove('hidden');
} else {
    // Direkt siteye girmiş, Oda kurma ekranını göster
    createScreen.classList.remove('hidden');
}

// --- 1. ODA KURMA İŞLEMİ ---
createBtn.addEventListener('click', () => {
    const pass = newRoomPassInput.value.trim();
    if (!pass) return alert("Lütfen oda için bir şifre belirleyin!");

    socket.emit('createRoom', pass, (roomId) => {
        // Linki oluştur ve o linke git
        window.location.href = `?oda=${roomId}`;
    });
});

// --- 2. ODAYA GİRME İŞLEMİ (ŞİFRE KONTROLÜ) ---
joinBtn.addEventListener('click', () => {
    const username = joinUsername.value.trim();
    const password = joinPassword.value.trim();

    if (!username || !password) return alert("Kullanıcı adı ve şifre zorunludur!");

    socket.emit('joinRoom', { roomId: currentRoomId, password, username }, (response) => {
        if (response.success) {
            passwordScreen.classList.add('hidden');
            mainScreen.classList.remove('hidden');
            
            // Eğer video zaten açıksa oynatıcıya bildir
            if (player && player.loadVideoById) {
                player.loadVideoById(response.videoId);
                if (response.isPlaying) {
                    setTimeout(() => { player.seekTo(response.time); player.playVideo(); }, 1000);
                } else {
                    setTimeout(() => { player.seekTo(response.time); player.pauseVideo(); }, 1000);
                }
            }
        } else {
            alert(response.message); // "Hatalı Şifre" vs.
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

socket.on('message', (data) => {
    const div = document.createElement('div');
    div.classList.add('message');
    div.style.borderLeftColor = data.color;
    div.innerHTML = `<div class="user" style="color: ${data.color}">${data.user}</div><div>${data.text}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// --- YOUTUBE VİDEO KONTROLLERİ ---
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