const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const ytSearch = require('yt-search');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    
    socket.on('createRoom', (password, callback) => {
        const roomId = Math.random().toString(36).substring(2, 8);
        rooms[roomId] = {
            password: password, 
            videoId: 'dQw4w9WgXcQ', 
            time: 0, 
            updatedAt: Date.now(), 
            isPlaying: false, 
            messages: [], 
            users: {},
            playlist: [],
            history: [],
            hostId: socket.id,
            locked: false
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

        room.users[socket.id] = { username: username, isMicOn: false, isCamOn: false, id: socket.id };
        
        // If room is empty or host disconnected previously, make this user host
        if (!room.hostId || !room.users[room.hostId]) {
            room.hostId = socket.id;
        }

        let currentRealTime = room.time;
        if (room.isPlaying) currentRealTime += (Date.now() - room.updatedAt) / 1000;

        callback({ 
            success: true, 
            videoId: room.videoId, 
            time: currentRealTime, 
            isPlaying: room.isPlaying, 
            messages: room.messages,
            playlist: room.playlist,
            history: room.history,
            hostId: room.hostId,
            locked: room.locked
        });

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

    // YouTube Search
    socket.on('searchVideo', async (query, callback) => {
        try {
            const r = await ytSearch(query);
            const videos = r.videos.slice(0, 15).map(v => ({ 
                id: v.videoId, 
                title: v.title, 
                author: v.author.name, 
                duration: v.timestamp, 
                image: v.image 
            }));
            callback({ success: true, videos });
        } catch (err) {
            callback({ success: false, message: 'Arama başarısız oldu.' });
        }
    });

    // Playlist Management
    socket.on('addToPlaylist', (video) => {
        if (!socket.roomId || !rooms[socket.roomId]) return;
        const room = rooms[socket.roomId];
        if (room.locked && room.hostId !== socket.id) return; // Only host can add if locked
        
        room.playlist.push(video);
        io.to(socket.roomId).emit('playlistUpdated', room.playlist);
        
        // If current video is the default one and not manually started, auto play
        if ((room.videoId === 'dQw4w9WgXcQ' || room.videoId === '') && room.playlist.length === 1 && !room.isPlaying) {
            const nextVideo = room.playlist.shift();
            room.videoId = nextVideo.id;
            room.time = 0;
            room.updatedAt = Date.now();
            room.isPlaying = true;
            io.to(socket.roomId).emit('playlistUpdated', room.playlist);
            io.to(socket.roomId).emit('videoChange', room.videoId);
        }
    });

    socket.on('removeFromPlaylist', (index) => {
        if (!socket.roomId || !rooms[socket.roomId]) return;
        const room = rooms[socket.roomId];
        if (room.locked && room.hostId !== socket.id) return;
        room.playlist.splice(index, 1);
        io.to(socket.roomId).emit('playlistUpdated', room.playlist);
    });

    socket.on('playNext', () => {
        if (!socket.roomId || !rooms[socket.roomId]) return;
        const room = rooms[socket.roomId];
        if (room.locked && room.hostId !== socket.id) return;

        if (room.videoId && room.videoId !== 'dQw4w9WgXcQ') {
            room.history.unshift({ id: room.videoId, playedAt: Date.now() });
            if (room.history.length > 20) room.history.pop();
            io.to(socket.roomId).emit('historyUpdated', room.history);
        }
        
        if (room.playlist.length > 0) {
            const nextVideo = room.playlist.shift();
            room.videoId = nextVideo.id;
            room.time = 0;
            room.updatedAt = Date.now();
            room.isPlaying = true;
            io.to(socket.roomId).emit('playlistUpdated', room.playlist);
            io.to(socket.roomId).emit('videoChange', room.videoId);
        } else {
            // Nothing to play
            room.videoId = '';
            room.isPlaying = false;
            io.to(socket.roomId).emit('videoChange', '');
        }
    });

    // Host Controls
    socket.on('toggleLock', () => {
        if (!socket.roomId || !rooms[socket.roomId]) return;
        const room = rooms[socket.roomId];
        if (room.hostId === socket.id) {
            room.locked = !room.locked;
            io.to(socket.roomId).emit('lockStatusChanged', room.locked);
            const msg = room.locked ? 'Oda kilitlendi (Sadece Host video açabilir).' : 'Oda kilidi açıldı (Herkes video açabilir).';
            io.to(socket.roomId).emit('message', { user: 'Sistem', text: msg, color: '#FFD700' });
        }
    });

    socket.on('setHost', (newHostId) => {
        if (!socket.roomId || !rooms[socket.roomId]) return;
        const room = rooms[socket.roomId];
        if (room.hostId === socket.id && room.users[newHostId]) {
            room.hostId = newHostId;
            io.to(socket.roomId).emit('hostChanged', room.hostId);
            io.to(socket.roomId).emit('message', { user: 'Sistem', text: `${room.users[newHostId].username} yeni Host oldu.`, color: '#FFD700' });
        }
    });

    socket.on('loadVideo', (videoId) => {
        if (socket.roomId && rooms[socket.roomId]) {
            if (rooms[socket.roomId].locked && rooms[socket.roomId].hostId !== socket.id) return;
            rooms[socket.roomId].videoId = videoId; rooms[socket.roomId].time = 0;
            rooms[socket.roomId].updatedAt = Date.now(); rooms[socket.roomId].isPlaying = true;
            io.to(socket.roomId).emit('videoChange', videoId);
        }
    });

    socket.on('playVideo', (time) => {
        if (socket.roomId && rooms[socket.roomId]) {
            if (rooms[socket.roomId].locked && rooms[socket.roomId].hostId !== socket.id) return;
            rooms[socket.roomId].time = time; rooms[socket.roomId].updatedAt = Date.now(); rooms[socket.roomId].isPlaying = true;
            socket.to(socket.roomId).emit('videoPlay', time);
        }
    });

    socket.on('pauseVideo', (time) => {
        if (socket.roomId && rooms[socket.roomId]) {
            if (rooms[socket.roomId].locked && rooms[socket.roomId].hostId !== socket.id) return;
            rooms[socket.roomId].time = time; rooms[socket.roomId].updatedAt = Date.now(); rooms[socket.roomId].isPlaying = false;
            socket.to(socket.roomId).emit('videoPause');
        }
    });

    socket.on('disconnect', () => {
        if (socket.username && socket.roomId && rooms[socket.roomId]) {
            const room = rooms[socket.roomId];
            delete room.users[socket.id];
            
            // Re-assign host if host left
            if (room.hostId === socket.id) {
                const userIds = Object.keys(room.users);
                if (userIds.length > 0) {
                    room.hostId = userIds[0];
                    io.to(socket.roomId).emit('hostChanged', room.hostId);
                    io.to(socket.roomId).emit('message', { user: 'Sistem', text: `${room.users[room.hostId].username} yeni Host oldu.`, color: '#FFD700' });
                } else {
                    room.hostId = null;
                }
            }

            const sysMsg = { user: 'Sistem', text: `${socket.username} ayrıldı.`, color: '#008B8B' };
            room.messages.push(sysMsg);
            socket.to(socket.roomId).emit('message', sysMsg);
            socket.to(socket.roomId).emit('user-left', socket.id);
            io.to(socket.roomId).emit('update-users', room.users);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu çalışıyor`));