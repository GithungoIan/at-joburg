# Africa's Talking – South Africa Workshop API

A Node.js API demonstrating Africa's Talking integrations for South African applications: SMS, USSD, Voice (IVR + AI + WebRTC), and Airtime.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
- [Exposing Your Server for Callbacks](#exposing-your-server-for-callbacks)
- [Services](#services)
  - [Airtime](#airtime)
  - [USSD – Lending App](#ussd--lending-app)
  - [USSD – Event Registration](#ussd--event-registration)
  - [Voice – Core IVR](#voice--core-ivr)
  - [Voice – Call Actions Examples](#voice--call-actions-examples)
  - [Voice – Gemini AI IVR](#voice--gemini-ai-ivr)
  - [Voice – WebRTC Softphone](#voice--webrtc-softphone)
- [AT Dashboard Setup](#at-dashboard-setup)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

---

## Requirements

- **Node.js** v18+
- **npm** v9+
- **Africa's Talking account** → [Sign up](https://account.africastalking.com/auth/register)
- **Google Gemini API key** (optional, for AI voice features) → [Get one](https://aistudio.google.com/app/apikey)
- A tunnelling tool (ngrok / cloudflared) to expose localhost to AT's servers

---

## Installation

```bash
# 1. Clone
git clone <repository-url>
cd at-nigeria

# 2. Install dependencies (includes @google/generative-ai and africastalking-client)
npm install

# 3. Create your .env file
cp .env.example .env   # or create it manually – see Configuration below
```

---

## Configuration

Create a `.env` file in the project root:

```env
# ── Africa's Talking (required) ──────────────────────────────────────
AT_API_KEY=your_at_api_key
AT_USERNAME=your_at_username          # use "sandbox" for testing

# ── Server ───────────────────────────────────────────────────────────
PORT=3000
APP_URL=https://your-tunnel.ngrok.io  # public URL (no trailing slash)

# ── Voice (required for voice features) ──────────────────────────────
VOICE_PHONE_NUMBER=+27XXXXXXXXX       # your AT virtual number

# ── WebRTC ───────────────────────────────────────────────────────────
WEBRTC_CLIENT_NAME=softphone-user     # clientName used when registering the browser

# ── Escalation ───────────────────────────────────────────────────────
ESCALATION_PHONE_NUMBER=+27XXXXXXXXX  # agent number for auto-escalations
AGENT_PHONE_NUMBER=+27XXXXXXXXX       # agent number for dequeue actions

# ── Gemini AI (optional – enables AI voice features) ─────────────────
GEMINI_API_KEY=your_google_gemini_key
```

### Where to find your AT credentials

1. Log in to the [AT Dashboard](https://account.africastalking.com)
2. **Settings → API Key** — copy your key
3. Your username is shown at the top of the dashboard (`sandbox` for testing)
4. **Voice → Phone Numbers** — copy the virtual number you want to use

---

## Running the Service

```bash
# Development (auto-reloads on file changes)
npm run dev

# Production
npm start
```

The server starts at `http://localhost:3000`.

**Verify it's running:**

```bash
curl http://localhost:3000
```

```json
{
  "status": "success",
  "message": "Africa's Talking Workshop API",
  "timestamp": "2026-03-02T10:00:00.000Z"
}
```

---

## Exposing Your Server for Callbacks

Africa's Talking needs a public HTTPS URL to send call/USSD events to your local server. Pick any tunnelling tool:

| Tool | Command | Notes |
|---|---|---|
| **ngrok** (recommended) | `ngrok http 3000` | Free tier, reliable, request inspector |
| **cloudflared** | `cloudflared tunnel --url http://localhost:3000` | Fast, free, no account needed |
| **localtunnel** | `lt --port 3000 --subdomain myapp` | Free, custom subdomain |
| **serveo** | `ssh -R 80:localhost:3000 serveo.net` | No install needed |

After starting a tunnel, copy the HTTPS URL (e.g. `https://abc123.ngrok.io`) and set it as `APP_URL` in your `.env`.

---

## Services

### Airtime

Send airtime to South African numbers.

**Endpoints**

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/airtime/send` | Send airtime to a single number |
| POST | `/api/airtime/send-bulk` | Send airtime to multiple numbers |

**Demo**

```bash
# Send ZAR 5 airtime to a number
curl -X POST http://localhost:3000/api/airtime/send \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+27712345678",
    "amount": "ZAR 5",
    "currencyCode": "ZAR"
  }'
```

---

### USSD – Lending App

A full micro-lending flow powered by a state-machine engine.

**Endpoint:** `POST /ussd`

**Flow:**

```
Dial *384*XXX#
  └─ 1. Apply for Loan
  │    └─ Enter full name
  │    └─ Enter SA ID number (13 digits)
  │    └─ Enter loan amount (ZAR 100–5,000)
  │    └─ Select period: 7 / 14 / 30 days
  │    └─ Confirm → Approved instantly
  ├─ 2. Check Balance
  ├─ 3. Loan History
  ├─ 4. Repay Loan
  └─ 5. Help
```

**Demo with curl**

```bash
# Step 1 – Open main menu
curl -X POST http://localhost:3000/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"za-001","phoneNumber":"+27712345678","serviceCode":"*384#","text":""}'

# Step 2 – Select "Apply for Loan"
curl -X POST http://localhost:3000/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"za-001","phoneNumber":"+27712345678","serviceCode":"*384#","text":"1"}'

# Step 3 – Enter name
curl -X POST http://localhost:3000/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"za-001","phoneNumber":"+27712345678","serviceCode":"*384#","text":"1*Thabo Nkosi"}'

# Step 4 – Enter SA ID number (13 digits)
curl -X POST http://localhost:3000/ussd \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"za-001","phoneNumber":"+27712345678","serviceCode":"*384#","text":"1*Thabo Nkosi*9001015009087"}'

# Step 5 – Use the simulator shortcut (all steps in one session)
curl -X POST http://localhost:3000/ussd/simulator \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+27712345678","input":""}'
```

---

### USSD – Event Registration

A simple if/else USSD app for the AT-GOOGLE SOUTH AFRICA event.

**Endpoint:** `POST /ussd/event`

**Flow:**

```
Dial *384*XXX#
  ├─ 1. Register for Event   → name → email → confirm → ticket number
  ├─ 2. Check-in             → enter ticket → confirm
  ├─ 3. View My Registration
  └─ 4. Event Info
```

**Demo with curl**

```bash
# Open the event menu
curl -X POST http://localhost:3000/ussd/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"za-evt-001","phoneNumber":"+27712345678","text":""}'

# Register (name step)
curl -X POST http://localhost:3000/ussd/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"za-evt-001","phoneNumber":"+27712345678","text":"1"}'

# Register (name → email)
curl -X POST http://localhost:3000/ussd/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"za-evt-001","phoneNumber":"+27712345678","text":"1*Amahle Dlamini"}'

# Register (name → email → confirm)
curl -X POST http://localhost:3000/ussd/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"za-evt-001","phoneNumber":"+27712345678","text":"1*Amahle Dlamini*amahle@email.com"}'

# Confirm registration
curl -X POST http://localhost:3000/ussd/event \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"za-evt-001","phoneNumber":"+27712345678","text":"1*Amahle Dlamini*amahle@email.com*1"}'

# View all registrations
curl http://localhost:3000/ussd/event/registrations
```

---

## Troubleshooting

**Missing environment variables**
```
Error: Missing required environment variables: AT_API_KEY, AT_USERNAME
```
Ensure your `.env` file exists and contains both variables.

**Port already in use**
```
Error: listen EADDRINUSE :::3000
```
Change `PORT` in `.env` or run `lsof -ti:3000 | xargs kill`.

**Gemini AI endpoints return 500**
```json
{ "status": "error", "message": "Gemini service is not available" }
```
Add `GEMINI_API_KEY` to `.env`. All other services still work without it.

**WebRTC token request fails (502)**
Ensure `AT_API_KEY`, `AT_USERNAME`, and `VOICE_PHONE_NUMBER` are all set. The token is fetched from AT's servers, so the sandbox credentials must have voice enabled.

**USSD session not maintaining state**
Always use the same `sessionId` across requests in a session, and ensure the `text` field accumulates inputs joined by `*`.

**Inbound calls not reaching the browser (WebRTC)**
- Confirm the AT dashboard Voice Callback URL is set to `https://your-tunnel/webrtc/voice-callback`
- Confirm `WEBRTC_CLIENT_NAME` in `.env` matches the `clientName` you registered with in the browser
- The browser tab must be open and registered before the call arrives

---

## Resources

- [Africa's Talking Docs](https://developers.africastalking.com/)
- [Voice API](https://developers.africastalking.com/docs/voice/overview)
- [WebRTC Client Docs](https://developers.africastalking.com/docs/voice/webRTC_client/overview)
- [USSD Docs](https://developers.africastalking.com/docs/ussd/overview)
- [AT Simulator](https://simulator.africastalking.com)
- [Node.js SDK](https://github.com/AfricasTalkingLtd/africastalking-node.js)
- [Google Gemini API](https://aistudio.google.com/app/apikey)

---

## License

MIT
