const socket = io();

const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('join-btn');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

// Sohbete Katıl
joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        socket.emit('join', username);
        loginContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        msgInput.focus();
    }
});

// Enter tuşu ile sohbete katıl
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinBtn.click();
});

// Mesaj Gönder
sendBtn.addEventListener('click', () => {
    const msg = msgInput.value.trim();
    if (msg) {
        socket.emit('chatMessage', msg);
        msgInput.value = '';
        msgInput.focus();
    }
});

// Enter tuşu ile mesaj gönder
msgInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendBtn.click();
});

// Gelen Mesajı Ekrana Yazdır
socket.on('message', (data) => {
    const div = document.createElement('div');
    div.classList.add('message');
    div.style.borderLeftColor = data.color;
    
    div.innerHTML = `
        <p class="meta" style="color: ${data.color}">${data.user}</p>
        <p class="text">${data.text}</p>
    `;
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Otomatik aşağı kaydır
});