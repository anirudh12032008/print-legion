# Environment Variables Setup

This project uses environment variables for configuration. Follow these steps to set up your environment.

## Backend Configuration

1. Copy the example file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `backend/.env` and fill in your values:
   - `AIRTABLE_KEY` - Your Airtable API key
   - `AIRTABLE_BASE_ID` - Your Airtable base ID
   - `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` - From your Slack app
   - `SLACK_OAUTH_REDIRECT_URI` - Your ngrok or production callback URL
   - `JWT_SECRET` - A random secret string for JWT signing
   - `BACKEND_URL` - Where your backend runs (default: http://localhost:3000)
   - `FRONTEND_URL` - Where your frontend runs (default: http://localhost:5173)

## Frontend Configuration

1. Copy the example file:
   ```bash
   cd site
   cp .env.example .env
   ```

2. Edit `site/.env`:
   - `VITE_API_URL` - Your backend URL (default: http://localhost:3000)

## Development URLs

**Local Development:**
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

**Production/Staging:**
Update the URLs in both `.env` files to match your deployment:
- Backend `.env`: Set `BACKEND_URL`, `FRONTEND_URL`, and `ADMIN_UI_REDIRECT`
- Frontend `.env`: Set `VITE_API_URL` to your backend URL

## Important Notes

- Never commit `.env` files to git (they're in `.gitignore`)
- Always commit `.env.example` files as templates
- Restart both servers after changing environment variables
- Vite env variables must be prefixed with `VITE_`
