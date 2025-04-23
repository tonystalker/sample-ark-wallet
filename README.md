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
