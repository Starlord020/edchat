const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statik dosyaları (HTML, CSS, JS) public klasöründen sun
app.use(express.static(path.join(__dirname, 'public')));

// Kullanıcıları RAM'de (geçici bellekte) tutuyoruz
let activeUsers = [];

io.on('connection', (socket) => {
    console.log('Yeni bir kullanıcı bağlandı:', socket.id);

    // Kullanıcı giriş yaptığında
    socket.on('join', (username) => {
        socket.username = username;
        
        if (!activeUsers.includes(username)) {
            activeUsers.push(username);
        }

        // Diğer kullanıcılara bildir
        socket.broadcast.emit('message', {
            user: 'Sistem',
            text: `${username} sohbete katıldı!`,
            color: '#008B8B' // Koyu Turkuaz
        });
    });

    // Mesaj gönderildiğinde
    socket.on('chatMessage', (msg) => {
        io.emit('message', {
            user: socket.username,
            text: msg,
            color: '#00CED1' // Turkuaz
        });
    });

    // Kullanıcı ayrıldığında
    socket.on('disconnect', () => {
        if (socket.username) {
            activeUsers = activeUsers.filter(user => user !== socket.username);

            io.emit('message', {
                user: 'Sistem',
                text: `${socket.username} sohbetten ayrıldı.`,
                color: '#008B8B'
            });
        }
    });
});

// Render'ın atadığı dinamik portu dinle
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu çalışıyor. Port: ${PORT}`);
});