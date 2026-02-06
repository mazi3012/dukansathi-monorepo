# Dukan Sathi Frontend

**Purpose:** React + Vite frontend for Dukan Sathi - India's first voice-first shop management solution.

## Features

- 🎙️ **Voice Input/Output** for hands-free operation
- 💬 **AI Chat Interface** with real-time WebSocket
- 📱 **Mobile-First Design** optimized for smartphones
- 🌐 **Offline PWA** with service worker caching
- 🇮🇳 **Hindi/Regional Languages** support
- 🎨 **Light Theme** for bright shop environments

## Tech Stack

- **Framework:** React 18 + Vite 6
- **Styling:** Vanilla CSS (mobile-first, accessible)
- **State:** React Context API
- **Auth:** Supabase Auth (Google OAuth + OTP)
- **Deployment:** Vercel

## Local Development Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
```

### Environment Variables

Create `.env.local` with:

```
VITE_SUPABASE_URL=https://xfnoquphbeaqslownzxw.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_BACKEND_WS_URL=ws://localhost:8000/ws/chat
```

### Run Development Server

```bash
npm run dev
```

App will be available at: `http://localhost:5173`

## Project Structure

```
frontend/
├── src/
│   ├── components/        # React components
│   │   ├── Chat/         # AI chat interface
│   │   ├── Dashboard/    # Main dashboard
│   │   ├── Sales/        # Invoice management
│   │   ├── Inventory/    # Product management
│   │   └── Auth/         # Login/signup
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom hooks
│   ├── services/         # API services
│   ├── styles/           # CSS files
│   ├── App.jsx           # Main app component
│   └── main.jsx          # Entry point
├── public/               # Static assets
├── index.html
├── vite.config.js
└── package.json
```

## Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## Deployment (Vercel)

1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to `main`

## Design Guidelines

- **Touch Targets:** Minimum 44x44px for all buttons
- **Contrast:** WCAG AA compliant (4.5:1 for text)
- **Single-Hand:** Bottom navigation for thumb reach
- **Light Theme:** Default for shop visibility
- **Simple:** Max 3 actions per screen

## Contributing

1. Follow English comment standards
2. Include file headers in all new components
3. Add prop-types or TypeScript for type safety
4. Test on real mobile devices

## License

Proprietary - Dukan Sathi Team 2026
