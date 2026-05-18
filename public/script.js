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

// --- YENİ: MEDYA (KAMERA/MİKROFON) VE KONTEYNER MANTIĞI ---
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const cameraBoxesContainer = document.getElementById('camera-boxes-container');
const localCameraBox = document.getElementById('local-camera-box');
const localVideo = document.getElementById('local-video');
const localCameraPlaceholder = localCameraBox.querySelector('.camera-placeholder');

let localStream = null;
let isMicOn = false;
let isCamOn = false;
const activeRemoteCameras = new Set(); // Açık olan diğer kameraları takip et

async function getMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getAudioTracks()[0].enabled = false;
        localStream.getVideoTracks()[0].enabled = false;
        localVideo.srcObject = localStream;
        // Başlangıçta mikrofon ve kamera kapalı olduğundan ikonları kapalı başlat
        toggleMicBtn.classList.add('muted');
        toggleCamBtn.classList.add('camera-off');
    } catch (err) {
        console.error("Medya cihazlarına erişilemedi:", err);
    }
}

// Konteynerın görünürlüğünü güncelle
function updateCameraContainerVisibility() {
    // Eğer yerel kamera açıksa veya en az bir diğer kamera açıksa konteyneri göster
    if (isCamOn || activeRemoteCameras.size > 0) {
        cameraBoxesContainer.classList.remove('hidden');
    } else {
        cameraBoxesContainer.classList.add('hidden');
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
        localCameraPlaceholder.style.display = 'none';
        updateCameraContainerVisibility();
    } else {
        toggleCamBtn.classList.add('camera-off');
        toggleCamBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
        localVideo.style.display = 'none';
        localCameraPlaceholder.style.display = 'block';
        updateCameraContainerVisibility();
    }
});

// --- SÜRÜKLE & BIRAK VE BOYUTLANDIRMA MANTIĞI ---
const playerWrapper = document.querySelector('.player-wrapper');

// Sürükle-bırak olaylarını `.camera-box` sınıfına sahip tüm öğeler için genelle
document.addEventListener('mousedown', (e) => {
    const draggableBox = e.target.closest('.camera-box');
    if (!draggableBox) return;

    // Boyutlandırma köşesinden tutulup tutulmadığını kontrol et
    // Webkit tabanlı tarayıcılarda `::-webkit-resizer` tıklamasını yakalamak zordur,
    // bu nedenle kutunun sağ/sol alt köşelerine tıklanıp tıklanmadığını kontrol edelim.
    const rect = draggableBox.getBoundingClientRect();
    const isResizing = (
        (e.clientX >= rect.right - 20 && e.clientX <= rect.right + 20 && e.clientY >= rect.bottom - 20 && e.clientY <= rect.bottom + 20) || // Sağ alt
        (e.clientX >= rect.left - 20 && e.clientX <= rect.left + 20 && e.clientY >= rect.bottom - 20 && e.clientY <= rect.bottom + 20) // Sol alt
    );

    if (!isResizing) {
        draggableBox.isDragging = true;
        draggableBox.offsetX = e.clientX - rect.left;
        draggableBox.offsetY = e.clientY - rect.top;
        draggableBox.style.cursor = 'grabbing';
        playerWrapper.style.pointerEvents = 'none'; 
    }
});

document.addEventListener('mousemove', (e) => {
    const draggableBox = [...document.querySelectorAll('.camera-box')].find(box => box.isDragging);
    if (!draggableBox) return;

    const parentRect = cameraBoxesContainer.getBoundingClientRect();
    let newX = e.clientX - parentRect.left - draggableBox.offsetX;
    let newY = e.clientY - parentRect.top - draggableBox.offsetY;

    // Kutuyu yeni yerine taşı
    // Konteyner flex olduğundan, sürüklenen kutunun konumunu manuel olarak ayarlamak için `position: absolute` kullanalım.
    // Ancak, konteynerın flex yapısını korumak daha iyidir.
    // Kutuyu sürüklemek için `transform: translate()` kullanalım.
    // Bu, flex düzenini etkilemez.
    // Sürüklenen kutunun transform değerlerini hesapla
    const currentTransform = draggableBox.style.transform;
    const transformMatch = currentTransform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    const currentX = transformMatch ? parseFloat(transformMatch[1]) : 0;
    const currentY = transformMatch ? parseFloat(transformMatch[2]) : 0;
    
    // Transform değerlerini güncelle
    const deltaX = e.clientX - (draggableBox.getBoundingClientRect().left + draggableBox.offsetX);
    const deltaY = e.clientY - (draggableBox.getBoundingClientRect().top + draggableBox.offsetY);
    
    // Kutuyu yeni transform değerleriyle taşı
    draggableBox.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
});

document.addEventListener('mouseup', () => {
    const draggableBox = [...document.querySelectorAll('.camera-box')].find(box => box.isDragging);
    if (draggableBox) {
        draggableBox.isDragging = false;
        draggableBox.style.cursor = 'grab';
        playerWrapper.style.pointerEvents = 'auto';
    }
});

// Boyutlandırma olaylarını yakalamak için `ResizeObserver` kullanalım
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        // Boyutlandırma bittiğinde video öğesini güncel tut
        const video = entry.target.querySelector('video, .remote-video');
        if (video) {
            video.style.width = '100%';
            video.style.height = '100%';
        }
    }
});

// Sayfa yüklendiğinde medya izinlerini iste ve yerel kamera kutusunu gözlemle
window.addEventListener('load', () => {
    getMediaStream();
    resizeObserver.observe(localCameraBox);
});