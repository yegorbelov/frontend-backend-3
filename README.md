# Контрольная работа №3

Небольшое **веб-приложение для заметок и задач**: можно вести список, хранить его локально, работать офлайн и получать **push-уведомления** с напоминаниями (в том числе с отложением из самого уведомления). Данные синхронизируются с сервером по **WebSocket**.

## Практика 13 — офлайн и Service Worker

- SPA для ведения списка заметок: просмотр и добавление записей.
- Сохранение данных в **localStorage**.
- Регистрация **Service Worker** и кэширование статических файлов.
- При потере сети интерфейс остаётся доступным: страница отдаётся из кэша, заметки можно смотреть и добавлять офлайн.

## Практика 14 — PWA

- Подключён **Web App Manifest** (`manifest.json`), чтобы приложение можно было установить на устройство и настроить иконки и метаданные.

## Практика 15 — App Shell и стратегии кэша

- Интерфейс выстроен по схеме **App Shell**.
- Работа по **HTTPS** (локально — самоподписанные `localhost.pem` / `localhost-key.pem` в каталоге `scratchpad/` и раздача сборки через `http-server`, см. раздел «Запуск»).
- Статика кэшируется при первом заходе.
- Для динамически подгружаемых страниц используется стратегия **Network First**.
- Добавлена страница **«О нас»** с описанием приложения.

## Практика 16 — сокеты и push

- Двусторонняя связь в реальном времени через **WebSocket** (библиотека **Socket.io**).
- **Push-уведомления**, в том числе когда вкладка с приложением закрыта (после подписки и настройки VAPID на сервере).

## Практика 17 — напоминания и действия в уведомлении

- У заметки можно указать **дату и время напоминания**.
- Планирование push на **сервере**.
- В уведомлении отображаются действия (в т.ч. **«Отложить на 5 минут»**).
- Обработка отложенного напоминания выполняется через **Service Worker**.

## Структура проекта

```text
frontend-backend-3/
├── README.md
├── scratchpad/               # клиент: React + TypeScript
│   ├── index.html
│   ├── vite.config.ts
│   ├── public/
│   │   ├── sw.js             # Service Worker
│   │   ├── manifest.json     # PWA manifest
│   │   ├── content/          # HTML для App Shell (home, about)
│   │   ├── icons/
│   │   └── svg/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── notesStorage.ts
│       ├── socket.ts         # Socket.io клиент
│       ├── pushNotifications.ts
│       ├── swApiBaseCache.ts
│       ├── serverBase.ts
│       ├── PushNotificationsButton.tsx
│       ├── TaskAddedToast.tsx
│       └── pages/
│           ├── HomePage.tsx
│           └── AboutPage.tsx
└── server/                   # сервер: Express + Socket.io + web-push
    ├── server.js
    ├── package.json
    └── subscriptions.json    # подписки (генерируется при работе)
```

Сборка клиента попадает в `scratchpad/dist/` (после `pnpm build` или `npm run build`).

---

## Запуск для разработки

1. **Бэкенд** (порт по умолчанию **3001**, переменная окружения `PORT` в `server/server.js`):

   ```bash
   cd server && pnpm install && pnpm start
   ```

2. **Клиент** (Vite; прокси для `/subscribe`, `/unsubscribe`, `/vapid-public`, `/snooze` настроен в `scratchpad/vite.config.ts`):

   ```bash
   cd scratchpad && pnpm install && pnpm dev
   ```

3. **Клиент по HTTPS** (собранная версия из `dist` с самоподписанным сертификатом(ключи предварительно нужно сгенерировать)). Сначала сборка, затем из каталога `scratchpad/`:

   ```bash
   cd scratchpad && pnpm build
   http-server ./dist --ssl --cert localhost.pem --key localhost-key.pem -p 5174
   ```

   Пакет [`http-server`](https://www.npmjs.com/package/http-server) можно поставить глобально (`pnpm i -g http-server`) или вызывать через `npx http-server ...`. В браузере открывайте `https://localhost:5174` (для самоподписанного сертификата один раз примите предупреждение безопасности).

Для push-уведомлений на сервере нужны **VAPID-ключи** (см. скрипт `npm run gen-vapid` в `server/package.json` и настройки в `server.js`).
