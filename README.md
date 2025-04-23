# ark-wallet

Go backend + React (Vite) + Cloudscape frontend for Ark & on‑chain payments.

## Environment Variables

Create a `.env` file in the project root with:

```bash
# Server settings (in /server)
ARK_SERVER_URL=http://localhost:7070
WALLET_PASSWORD=your_password

# Frontend settings (in /client)
VITE_API_BASE_URL=http://localhost:8080
```

## Development

### Backend

```bash
cd server
go mod tidy
go run main.go
```

### Frontend

```bash
cd client
npm install
npm run dev  # opens http://localhost:3001
```

## Production Build

### Backend

```bash
cd server
go build -o ark-wallet .
```

### Frontend

```bash
cd client
npm run build  # outputs to client/dist
```

## GitHub

```bash
git init
git add .
git commit -m "Cleanup comments & update README"
git branch -M main
# add your remote:
# git remote add origin git@github.com:YOUR_USERNAME/ark-wallet.git
git push -u origin main
```

## Deployment

### Frontend to Vercel

1. Import this repo in Vercel.
2. Set root directory to `/client`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add env var `VITE_API_BASE_URL`.

### Backend to Railway

1. Import this repo in Railway.
2. Set root directory to `/server`.
3. Build command: `go build -o ark-wallet .`.
4. Start command: `./ark-wallet`.
5. Add env vars `ARK_SERVER_URL` and `WALLET_PASSWORD`.
