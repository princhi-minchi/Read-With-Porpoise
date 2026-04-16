# Read With Porpoise: Project Strategy & Roadmap

This document outlines the vision, technical architecture, and roadmap for **Read With Porpoise**, a language learning ecosystem designed to help users learn through authentic reading.

## 1. Product Vision
Transform any webpage into an interactive, color-coded learning environment using high-quality NLP (Babelscape) and AI translations (DeepL), backed by a gamified SRS dashboard.

---

## 2. Core Components

### A. Browser Extension (The Reader)
- **Feature**: Selection-triggered analysis. Users highlight text, click a hovering "Porpoise" icon, and the text becomes interactive.
- **Visuals**: Color-coded "boxes" around words based on Part-of-Speech (POS) tags.
- **Interaction**: Clickable words reveal a morphological breakdown and conjugation tables (for verbs) via an injected sidebar.
- **Translation**: Full-phrase translation provided by DeepL.
- **Persistence**: Ability to "Save" words directly to the user's dashboard.

### B. Online Dashboard (The Hub)
- **SRS Review**: Spaced Repetition quizzes (Flashcards, Fill-in-the-blank).
- **Gamification**: "The Reef" — A visual, evolving representation of the user's vocabulary growth (Streaks, XP, Levels).
- **Management**: A place to review, organize, and delete saved words.

---

## 3. Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Extension Framework** | Plasmo / React | Simplified Manifest V3, cross-browser builds. |
| **Styling** | Tailwind CSS + Shadcn/UI | Modern, premium aesthetic with fast development. |
| **Web Framework** | Next.js (App Router) | Gold standard for speed, SEO, and developer experience. |
| **Backend/Auth** | Supabase | Instant Postgres database and Google/Email auth. |
| **NLP** | Babelscape API | Tokenization, POS Tagging, and Morphological analysis. |
| **Translation** | DeepL API | Premium-quality, natural translations. |
| **Conjugation Data** | Cloudflare KV | Fast, globally distributed verb lookup (Existing Asset). |

---

## 4. Technical Strategy

### Cross-Browser Compatibility
To ensure a consistent "Premium" experience across **Chrome, Firefox, and Safari**, the extension will use an **Injected Content Sidebar** (Shadow DOM) instead of browser-native side panels. This prevents CSS conflicts and layout breakage across different browsers.

### Cost & Data Optimization
- **Unit Economics**: Free tier limited to **25 Porpoise Clicks per month**.
- **Caching**: Implement a "Word/Lemma Caching" layer in Supabase to reduce expensive third-party API calls (Babelscape/DeepL) for common terms.

---

## 5. Development Roadmap

### Phase 1: Infrastructure & API Proxy
- [ ] Set up Supabase project and database schema.
- [ ] Create Next.js API routes to proxy call to Babelscape and DeepL (keeping keys secure).
- [ ] Integrate existing Cloudflare KV conjugation lookup.

### Phase 2: Extension MVP
- [ ] Implement text selection listener and "Hovering Porpoise" trigger.
- [ ] Build the content script to overlay clickable POS boxes on the page.
- [ ] Create the Injected Sidebar UI for translation and word details.

### Phase 3: Dashboard & Retention
- [ ] Build the "Reef" dashboard with vocab lists synced from Supabase.
- [ ] Implement basic Spaced Repetition (SRS) logic.
- [ ] Add gamification elements (Streaks, XP).

---

## 6. Business Model (Proposed)
- **Free**: 25 Clicks/month + Basic SRS access.
- **Premium**: Unlimited Clicks + Full Conjugation Access + "The Reef" Customization + Offline Export.
