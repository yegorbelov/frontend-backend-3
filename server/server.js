const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const vapidKeys = {
  publicKey:
    process.env.VAPID_PUBLIC_KEY ||
    'BI4y8MisIq2xUG8jypzYy7goyswuHH8LZ-m2vAPJzI4RAyz_7lIQy0aVda0XAjFMUro9fvTL6fPy8ebzSdlBzAY',
  privateKey:
    process.env.VAPID_PRIVATE_KEY ||
    'gwiuWMVmeG3-XjohSe9TLehXhollVCTcy0Co5jy0zhY',
};

webpush.setVapidDetails(
  process.env.VAPID_CONTACT || 'mailto:student@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/vapid-public', (_req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

let subscriptions = [];

const clientDist = path.join(__dirname, '..', 'scratchpad', 'dist');

app.post('/subscribe', (req, res) => {
  const body = req.body;
  const endpoint = body && body.endpoint;
  if (!endpoint) {
    return res.status(400).json({ message: 'Missing subscription endpoint' });
  }
  subscriptions = subscriptions.filter((sub) => sub.endpoint !== endpoint);
  subscriptions.push(body);
  res.status(201).json({ message: 'Subscription saved' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ message: 'Missing endpoint' });
  }
  const before = subscriptions.length;
  subscriptions = subscriptions.filter((sub) => sub.endpoint !== endpoint);
  if (subscriptions.length === before) {
    return res.status(200).json({ message: 'Subscription was not on server' });
  }
  res.status(200).json({ message: 'Subscription removed' });
});

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
} else {
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/socket.io')) return next();
    res
      .status(503)
      .type('html')
      .send(
        '<p>Build the client first: <code>cd ../scratchpad && npm run build</code>, then restart the server.</p>',
      );
  });
}

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('newTask', (task) => {
    io.emit('taskAdded', task);

    const payload = JSON.stringify({
      title: 'New task',
      body: task.text || '',
    });

    void Promise.all(
      subscriptions.map((sub) =>
        webpush.sendNotification(sub, payload).catch((err) => {
          console.error('Push error:', err);
          const code = err.statusCode;
          if (code === 410 || code === 404) {
            subscriptions = subscriptions.filter(
              (s) => s.endpoint !== sub.endpoint,
            );
          }
        }),
      ),
    );
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
