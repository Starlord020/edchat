// ... (Önceki script.js kodlarının tamamı burada kalacak, altına bunu ekle) ...

// --- YENİ: MEDYA KONTROLLERİ (Kamera & Mikrofon) ---
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const localVideo = document.getElementById('local-video');
const cameraPlaceholder = document.querySelector('.camera-placeholder');

let localStream = null;
let isMicOn = false;
let isCamOn = false;

// Kullanıcının medya cihazlarına erişim sağla
async function getMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Başlangıçta ikisini de kapat (İkonlar kapalı başlıyor)
        localStream.getAudioTracks()[0].enabled = false;
        localStream.getVideoTracks()[0].enabled = false;

        localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Medya cihazlarına erişilemedi:", err);
        alert("Kamera veya mikrofona erişim izni verilmedi.");
    }
}

// Mikrofon Aç/Kapat
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

// Kamera Aç/Kapat
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

// Sayfa yüklendiğinde medya izinlerini iste
window.addEventListener('load', getMediaStream);