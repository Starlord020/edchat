const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let activeUsers = [];
let currentVideoId = 'dQw4w9WgXcQ'; // Başlangıç videosu
let currentVideoTime = 0;
let isVideoPlaying = false;

io.on('connection', (socket) => {
    
    // Yeni bağlanan kullanıcıya mevcut video durumunu gönder
    socket.emit('videoChange', currentVideoId);
    if (isVideoPlaying) {
        socket.emit('videoPlay', currentVideoTime);
    } else {
        socket.emit('videoPause');
        socket.emit('videoSeek', currentVideoTime);
    }

    socket.on('join', (username) => {
        socket.username = username;
        if (!activeUsers.includes(username)) activeUsers.push(username);
        
        socket.broadcast.emit('message', { user: 'Sistem', text: `${username} odaya katıldı.`, color: '#008B8B' });
    });

    socket.on('chatMessage', (msg) => {
        io.emit('message', { user: socket.username || 'Anonim', text: msg, color: '#00CED1' });
    });

    // --- VİDEO KONTROLLERİ ---
    socket.on('loadVideo', (videoId) => {
        currentVideoId = videoId;
        currentVideoTime = 0;
        isVideoPlaying = true;
        io.emit('videoChange', videoId);
        io.emit('message', { user: 'Sistem', text: `${socket.username || 'Biri'} yeni video açtı.`, color: '#FF4500' });
    });

    socket.on('playVideo', (time) => {
        currentVideoTime = time;
        isVideoPlaying = true;
        socket.broadcast.emit('videoPlay', time);
    });

    socket.on('pauseVideo', (time) => {
        currentVideoTime = time;
        isVideoPlaying = false;
        socket.broadcast.emit('videoPause');
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            activeUsers = activeUsers.filter(user => user !== socket.username);
            io.emit('message', { user: 'Sistem', text: `${socket.username} ayrıldı.`, color: '#008B8B' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu port ${PORT} üzerinde çalışıyor`));