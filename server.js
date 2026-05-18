const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Odaları hafızada tutacağımız obje
// Örnek: rooms['12345'] = { password: 'abc', videoId: '...', time: 0, isPlaying: false }
const rooms = {};

io.on('connection', (socket) => {
    
    // 1. ODA OLUŞTURMA
    socket.on('createRoom', (password, callback) => {
        const roomId = Math.random().toString(36).substring(2, 8); // Rastgele 6 haneli kod
        rooms[roomId] = {
            password: password,
            videoId: 'dQw4w9WgXcQ', // Başlangıç videosu
            time: 0,
            isPlaying: false
        };
        callback(roomId);
    });

    // 2. ODAYA KATILMA VE ŞİFRE KONTROLÜ
    socket.on('joinRoom', ({ roomId, password, username }, callback) => {
        const room = rooms[roomId];
        
        if (!room) {
            return callback({ success: false, message: 'Böyle bir oda bulunamadı.' });
        }
        if (room.password !== password) {
            return callback({ success: false, message: 'Hatalı şifre!' });
        }

        // Şifre doğruysa kullanıcıyı odaya al
        socket.join(roomId);
        socket.username = username;
        socket.roomId = roomId;

        callback({ success: true, videoId: room.videoId, time: room.time, isPlaying: room.isPlaying });

        // Odadakilere haber ver
        socket.to(roomId).emit('message', { user: 'Sistem', text: `${username} odaya katıldı.`, color: '#00CED1' });
    });

    // 3. SOHBET
    socket.on('chatMessage', (msg) => {
        if (socket.roomId) {
            io.to(socket.roomId).emit('message', { user: socket.username, text: msg, color: '#40E0D0' });
        }
    });

    // 4. VİDEO KONTROLLERİ (Sadece aynı odadakilere gider)
    socket.on('loadVideo', (videoId) => {
        if (socket.roomId && rooms[socket.roomId]) {
            rooms[socket.roomId].videoId = videoId;
            rooms[socket.roomId].time = 0;
            rooms[socket.roomId].isPlaying = true;
            io.to(socket.roomId).emit('videoChange', videoId);
            io.to(socket.roomId).emit('message', { user: 'Sistem', text: `${socket.username} yeni video açtı.`, color: '#FF4500' });
        }
    });

    socket.on('playVideo', (time) => {
        if (socket.roomId && rooms[socket.roomId]) {
            rooms[socket.roomId].time = time;
            rooms[socket.roomId].isPlaying = true;
            socket.to(socket.roomId).emit('videoPlay', time);
        }
    });

    socket.on('pauseVideo', (time) => {
        if (socket.roomId && rooms[socket.roomId]) {
            rooms[socket.roomId].time = time;
            rooms[socket.roomId].isPlaying = false;
            socket.to(socket.roomId).emit('videoPause');
        }
    });

    socket.on('disconnect', () => {
        if (socket.username && socket.roomId) {
            socket.to(socket.roomId).emit('message', { user: 'Sistem', text: `${socket.username} ayrıldı.`, color: '#008B8B' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu port ${PORT} üzerinde çalışıyor`));