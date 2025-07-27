# Vercel Deployment Guide

## Bio-Acoustic Modulation App - Vercel Deployment

This guide explains how to deploy the bio-acoustic modulation application to Vercel.

## Prerequisites

1. A Vercel account (https://vercel.com)
2. Git repository with your code
3. Vercel CLI (optional): `npm i -g vercel`

## Deployment Steps

### 1. Prepare Your Repository

Ensure your repository has these files:
- `vercel.json` - Vercel configuration
- `build-vercel.js` - Custom build script
- `api/index.js` - Serverless API function

### 2. Deploy via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import your Git repository
4. **IMPORTANT**: Override the auto-detected settings with these:
   - **Framework Preset**: Other
   - **Build Command**: `vite build --config vite.config.ts`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`
   
   Or let Vercel use the `vercel.json` configuration automatically.

### 3. Deploy via CLI

```bash
# Login to Vercel
vercel login

# Deploy
vercel --prod
```

## Project Structure for Vercel

```
/
├── api/
│   └── health.js        # Simple health check API
├── client/              # React frontend source
├── server/              # Original Express server (for local dev)
├── dist/
│   └── public/          # Built frontend (Vercel serves this)
├── vercel.json          # Vercel configuration
├── DEPLOYMENT.md        # This deployment guide
└── package.json
```

## Environment Variables

The app runs entirely on the frontend with microphone access, so no special environment variables are required for basic functionality.

## Features in Production

✅ **Real-time Microphone Analysis**: Works in browser with user permission
✅ **Bio-acoustic Breathing Detection**: Client-side processing
✅ **AI Stress Assessment**: Local analysis algorithms  
✅ **Therapeutic Frequency Generation**: Web Audio API
✅ **Auto-entrainment System**: Real-time adaptation
✅ **Responsive Design**: Mobile and desktop support

## Important Notes

1. **HTTPS Required**: Microphone access requires secure context (Vercel provides HTTPS)
2. **User Interaction**: Audio features require user gesture to activate (click/touch)
3. **Browser Compatibility**: Modern browsers with Web Audio API support
4. **No Backend Dependency**: App works entirely in the browser
5. **Cross-Origin Headers**: Configured for microphone and audio access

## Troubleshooting

### Microphone Not Working
- Ensure HTTPS is enabled (automatic on Vercel)
- Check browser permissions
- User must interact with page before audio starts

### Build Fails
- Ensure Framework Preset is set to "Other" (not Node.js)
- Verify build command is `vite build --config vite.config.ts`
- Check that output directory is `dist/public`
- Verify all dependencies are in package.json
- Check Vercel build logs

### Wrong Content Served (seeing server code)
- Ensure Framework Preset is "Other", not "Node.js"
- Check that `outputDirectory` in vercel.json is `dist/public`
- Verify the build command creates files in `dist/public/`
- Redeploy after fixing configuration

### API Issues
- The app works without API calls
- API endpoints are optional for future features
- Check function logs in Vercel dashboard

## Performance

- **Bundle Size**: ~363KB (gzipped: ~115KB)
- **CSS**: ~68KB (gzipped: ~12KB)
- **Cold Start**: < 100ms for API functions
- **Audio Latency**: < 50ms for real-time processing

## Custom Domain

1. In Vercel dashboard, go to your project
2. Click "Domains" tab
3. Add your custom domain
4. Configure DNS settings as shown

Your bio-acoustic modulation app will be available at your Vercel URL with full functionality!