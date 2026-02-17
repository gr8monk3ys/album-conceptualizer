# Expo Mobile App — Design Document

**Date:** 2026-02-16
**Status:** Approved

## Overview

Build an Expo/React Native mobile app for Album Conceptualizer with full feature parity to the Next.js web app. Targets iOS + Android, online-only for MVP.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API target | Next.js BFF | Single backend, auth already handled |
| Navigation | Expo Router v4 | File-based routing, mirrors Next.js |
| Server state | React Query | Caching, refetch, optimistic updates |
| Client state | Zustand | Lightweight, no boilerplate |
| Styling | NativeWind | Tailwind for RN, matches web conventions |
| Icons | lucide-react-native | Same icon set as web app |
| Audio | expo-av | MP3 playback for previews |
| Auth | Expo AuthSession + JWT | GitHub OAuth via system browser |
| Storage | expo-secure-store | Secure JWT token persistence |
| Offline | Online only | MVP simplicity |

## Architecture

### Auth Flow

1. Expo AuthSession opens system browser for GitHub OAuth
2. GitHub redirects back with authorization code
3. App sends code to `POST /api/auth/mobile` (new backend route)
4. Backend exchanges code for GitHub token, creates/finds user, issues JWT
5. App stores JWT in SecureStore, attaches as Bearer token on all requests

### Navigation Structure

```
Root Layout (providers, auth gate)
├── (auth)/ — Sign in, Sign up
├── (tabs)/ — Authenticated tab navigator
│   ├── Home (dashboard)
│   ├── Library (user albums)
│   ├── Create (+) (new album)
│   ├── Discover (public albums)
│   └── Notifications (inbox)
├── album/[albumId]/ — Album workspace
│   ├── Overview
│   ├── Studio (song/section editor)
│   ├── Bible (themes, characters, motifs)
│   ├── Coherence (narrative checker)
│   ├── Export (format selection + download)
│   ├── Versions (snapshot history)
│   ├── Inbox (comments + tasks)
│   └── collab/[roomId] (live room)
├── settings/ — Account + billing
└── share/[token] — Public shared album
```

### State Management

- **React Query**: albums, songs, notifications, billing, all server data
- **Zustand stores**:
  - `auth-store`: JWT, user, workspace ID
  - `player-store`: current track, position, queue
  - `editor-store`: active editing context, unsaved changes

### Real-time

- WebSocket client for collab rooms
- Auto-reconnect with exponential backoff
- Events: participants, comments, board items, snapshots

### Audio & Media

- expo-av for MP3 playback
- Persistent mini-player bar above tab bar
- expo-file-system + expo-sharing for export downloads

### Build & Distribution

- EAS Build for iOS/Android binaries
- EAS Update for OTA JS updates
- Environment configs: development, preview, production
