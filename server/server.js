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

const subscriptionsPath = path.join(__dirname, 'subscriptions.json');

function loadSubscriptions() {
  try {
    if (fs.existsSync(subscriptionsPath)) {
      const raw = fs.readFileSync(subscriptionsPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Could not load subscriptions.json:', err.message);
  }
  return [];
}

function saveSubscriptions() {
  try {
    fs.writeFileSync(subscriptionsPath, JSON.stringify(subscriptions), 'utf8');
  } catch (err) {
    console.error('Could not save subscriptions.json:', err.message);
  }
}

let subscriptions = loadSubscriptions();
if (subscriptions.length) {
  console.log(`Loaded ${subscriptions.length} push subscription(s) from disk`);
}

const reminders = new Map();

const clientDist = path.join(__dirname, '..', 'scratchpad', 'dist');

app.post('/subscribe', (req, res) => {
  const body = req.body;
  const endpoint = body && body.endpoint;
  if (!endpoint) {
    return res.status(400).json({ message: 'Missing subscription endpoint' });
  }
  subscriptions = subscriptions.filter((sub) => sub.endpoint !== endpoint);
  subscriptions.push(body);
  saveSubscriptions();
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
  saveSubscriptions();
  res.status(200).json({ message: 'Subscription removed' });
});

app.post('/snooze', (req, res) => {
  const reminderId = parseInt(String(req.query.reminderId), 10);
  if (!Number.isFinite(reminderId) || !reminders.has(reminderId)) {
    return res.status(404).json({ error: 'Reminder not found' });
  }
  const reminder = reminders.get(reminderId);
  if (reminder.timeoutId) clearTimeout(reminder.timeoutId);
  const newDelay = 5 * 60 * 1000;
  const newTimeoutId = setTimeout(() => {
    const payload = JSON.stringify({
      title: 'Snoozed reminder',
      body: reminder.text,
      reminderId,
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
            saveSubscriptions();
          }
        }),
      ),
    );
    reminders.set(reminderId, {
      timeoutId: null,
      text: reminder.text,
      reminderTime: Date.now(),
    });
  }, newDelay);
  reminders.set(reminderId, {
    timeoutId: newTimeoutId,
    text: reminder.text,
    reminderTime: Date.now() + newDelay,
  });
  res.status(200).json({ message: 'Reminder snoozed for 5 minutes' });
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
            saveSubscriptions();
          }
        }),
      ),
    );
  });

  socket.on('newReminder', (reminder) => {
    const { id, text } = reminder;
    const reminderTime = Number(reminder.reminderTime);
    if (id == null || typeof text !== 'string') {
      console.warn('newReminder: invalid payload', reminder);
      return;
    }
    if (!Number.isFinite(reminderTime)) {
      console.warn('newReminder: invalid reminderTime', reminder);
      return;
    }
    const rawDelay = reminderTime - Date.now();
    if (rawDelay < -30_000) {
      console.warn('newReminder: time is more than 30s in the past, ignoring', {
        id,
        reminderTime,
        rawDelay,
      });
      return;
    }
    const delay = Math.max(rawDelay, 500);
    if (subscriptions.length === 0) {
      console.warn(
        'newReminder: no push subscriptions — notification will not be delivered. Enable push in the app header.',
      );
    }
    console.log(
      `newReminder: id=${id} scheduled in ${Math.round(delay / 1000)}s (${subscriptions.length} subscriber(s))`,
    );
    const existing = reminders.get(id);
    if (existing?.timeoutId) clearTimeout(existing.timeoutId);
    const timeoutId = setTimeout(() => {
      const payload = JSON.stringify({
        title: 'Reminder',
        body: text,
        reminderId: id,
      });
      if (subscriptions.length === 0) {
        console.warn(
          'newReminder: timer fired but subscriptions list is empty — nothing to send',
        );
      }
      void Promise.all(
        subscriptions.map((sub) =>
          webpush.sendNotification(sub, payload).catch((err) => {
            console.error('Push error:', err);
            const code = err.statusCode;
            if (code === 410 || code === 404) {
              subscriptions = subscriptions.filter(
                (s) => s.endpoint !== sub.endpoint,
              );
              saveSubscriptions();
            }
          }),
        ),
      );
      reminders.set(id, {
        timeoutId: null,
        text,
        reminderTime: Date.now(),
      });
    }, delay);
    reminders.set(id, { timeoutId, text, reminderTime });
  });

  socket.on('cancelReminder', (payload) => {
    const rawId = payload && payload.id;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return;
    const r = reminders.get(id);
    if (r?.timeoutId) clearTimeout(r.timeoutId);
    reminders.delete(id);
    console.log(`cancelReminder: id=${id}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
