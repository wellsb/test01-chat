const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const BASE_URL = "http://192.168.0.170";

// Enable CORS for the Express server
app.use(cors({
  origin: BASE_URL, // Client-side origin
  methods: ['GET', 'POST'], // Allowed HTTP methods
  credentials: true, // Enable cookies/auth headers if needed
}));

// Enable CORS for the Socket.IO server
const io = socketio(server, {
  cors: {
    origin: BASE_URL, // Client-side origin (update as needed)
    methods: ['GET', 'POST'], // Allowed methods
    credentials: true, // Optional - for credentials
  },
});

io.on('connection', (socket) => {
  console.log(`conn: ${socket.id.slice(-5)}`);

  socket.on('aMessage', (msg) => {
    console.log(`mess: ${socket.id.slice(-5)}: ${msg}`); // Include sender's socket ID
    // Broadcast to all connected clients
    io.emit('aMessage', { id: socket.id, message: msg });
  });

  socket.on('disconnect', () => {
    console.log(`disc: ${socket.id.slice(-5)}`);
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});