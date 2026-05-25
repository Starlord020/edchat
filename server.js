const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    
    socket.on('createRoom', (password, callback) => {
        const roomId = Math.random().toString(36).substring(2, 8);
        rooms[roomId] = {
            password: password, videoId: 'dQw4w9WgXcQ', time: 0, 
            updatedAt: Date.now(), isPlaying: false, messages: [], users: {}
        };
        callback(roomId);
    });

    socket.on('joinRoom', ({ roomId, password, username }, callback) => {
        const room = rooms[roomId];
        if (!room) return callback({ success: false, message: 'Böyle bir oda bulunamadı.' });
        if (room.password !== password) return callback({ success: false, message: 'Hatalı şifre!' });

        socket.join(roomId);
        socket.username = username;
        socket.roomId = roomId;

        room.users[socket.id] = { username: username, isMicOn: false, isCamOn: false };

        let currentRealTime = room.time;
        if (room.isPlaying) currentRealTime += (Date.now() - room.updatedAt) / 1000;

        callback({ success: true, videoId: room.videoId, time: currentRealTime, isPlaying: room.isPlaying, messages: room.messages });

        const sysMsg = { user: 'Sistem', text: `${username} odaya katıldı.`, color: '#00CED1' };
        room.messages.push(sysMsg);
        if(room.messages.length > 50) room.messages.shift();
        
        io.to(roomId).emit('message', sysMsg);
        socket.to(roomId).emit('user-joined', socket.id, username);
        io.to(roomId).emit('update-users', room.users);
    });

    socket.on('mediaState', (state) => {
        if (socket.roomId && rooms[socket.roomId] && rooms[socket.roomId].users[socket.id]) {
            rooms[socket.roomId].users[socket.id].isMicOn = state.isMicOn;
            rooms[socket.roomId].users[socket.id].isCamOn = state.isCamOn;
            rooms[socket.roomId].users[socket.id].isScreenSharing = state.isScreenSharing || false;
            io.to(socket.roomId).emit('update-users', rooms[socket.roomId].users);
        }
    });

    socket.on('signal', (toId, message) => { io.to(toId).emit('signal', socket.id, message); });

    socket.on('chatMessage', (msg) => {
        if (socket.roomId && rooms[socket.roomId]) {
            const msgData = { user: socket.username, text: msg, color: '#40E0D0' };
            rooms[socket.roomId].messages.push(msgData);
            io.to(socket.roomId).emit('message', msgData);
        }
    });

    socket.on('loadVideo', (videoId) => {
        if (socket.roomId && rooms[socket.roomId]) {
            rooms[socket.roomId].videoId = videoId; rooms[socket.roomId].time = 0;
            rooms[socket.roomId].updatedAt = Date.now(); rooms[socket.roomId].isPlaying = true;
            io.to(socket.roomId).emit('videoChange', videoId);
        }
    });

    socket.on('playVideo', (time) => {
        if (socket.roomId && rooms[socket.roomId]) {
            rooms[socket.roomId].time = time; rooms[socket.roomId].updatedAt = Date.now(); rooms[socket.roomId].isPlaying = true;
            socket.to(socket.roomId).emit('videoPlay', time);
        }
    });

    socket.on('pauseVideo', (time) => {
        if (socket.roomId && rooms[socket.roomId]) {
            rooms[socket.roomId].time = time; rooms[socket.roomId].updatedAt = Date.now(); rooms[socket.roomId].isPlaying = false;
            socket.to(socket.roomId).emit('videoPause');
        }
    });

    socket.on('disconnect', () => {
        if (socket.username && socket.roomId && rooms[socket.roomId]) {
            delete rooms[socket.roomId].users[socket.id];
            const sysMsg = { user: 'Sistem', text: `${socket.username} ayrıldı.`, color: '#008B8B' };
            rooms[socket.roomId].messages.push(sysMsg);
            socket.to(socket.roomId).emit('message', sysMsg);
            socket.to(socket.roomId).emit('user-left', socket.id);
            io.to(socket.roomId).emit('update-users', rooms[socket.roomId].users);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu çalışıyor`));