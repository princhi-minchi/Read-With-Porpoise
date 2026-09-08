# PorpoiseRead 🐬

**Turn the internet into your language-learning material.**

PorpoiseRead is a browser extension and learning dashboard that lets language learners study from content they actually want to read.

Instead of learning from a fixed library of generic lessons, users can select text on almost any webpage and turn it into interactive learning material: translations, grammatical breakdowns, verb conjugations, vocabulary saving, and spaced-repetition review.

Currently built for **Italian and Spanish learners with English as their native language**.

**[1-minute pitch](https://www.youtube.com/watch?v=Xzj8gT2izLk)** · **[Pitch deck](./Pitch%20Deck-1.pdf)** · **[ConjuMate — the project PorpoiseRead evolved from](https://github.com/princhi-minchi/LangHover)**

---

## Why I built it

Why should two people learning Italian have to learn from the same sequence of sentences?

A banker moving to Milan, someone reading Italian football news, and someone interested in Italian politics have different reasons for learning the language — but most language-learning products give them essentially the same curriculum.

I became interested in a different model:

> **What if the content you already consume became the curriculum?**

PorpoiseRead is an attempt to make that possible.

Rather than asking users to leave the internet and enter a language-learning app, PorpoiseRead brings the learning layer to whatever they are already reading.

---

## How it works

### 1. Read something you care about

Open an article, blog, Wikipedia page, news site, or other webpage in the language you're learning.

### 2. Select text

Highlight a sentence or passage and activate PorpoiseRead.

The extension analyses the selected text and replaces it temporarily with interactive, colour-coded tokens based on their grammatical role.

### 3. Explore the language

A sidebar provides a breakdown of the selected text, including:

* English translation
* Part-of-speech identification
* Lemmas / base word forms
* Morphological information
* Verb information and conjugation data

Clicking a word in the webpage connects it to the corresponding linguistic information in the sidebar.

### 4. Save vocabulary

Interesting words can be saved directly from the extension to the user's PorpoiseRead account.

### 5. Review what you've learned

Saved vocabulary appears in the web dashboard, where it can be reviewed using a spaced-repetition system.

The idea is to create a loop:

```text
Read something interesting
        ↓
Understand it in context
        ↓
Save useful vocabulary
        ↓
Review it later
        ↓
Recognise it next time you read
```

---

## Current prototype

PorpoiseRead is **under active development** rather than a finished consumer product.

The current prototype includes:

### Browser extension

* Text selection on arbitrary webpages
* In-page grammatical annotation
* Colour-coded part-of-speech tokens
* Morphological analysis
* DeepL translation
* Italian and Spanish support
* Verb lookup and conjugation data
* Interactive sidebar rendered using Shadow DOM
* Vocabulary saving
* User authentication

### Learning dashboard

* User accounts
* Saved-word library
* Vocabulary management
* Learning statistics
* XP / level / streak tracking
* Spaced-repetition flashcard reviews

Some UI and learning mechanics are still being developed and refined.

---

## Architecture

PorpoiseRead is a monorepo containing two main applications:

```text
Read-With-Porpoise/
│
├── extension/
│   └── Chrome extension
│
├── dashboard/
│   └── Web app + API layer
│
├── agent-guides/
│   └── Build specifications
│
└── docs/
```

### Extension

The Chrome extension is built with:

* **Plasmo**
* **React**
* **TypeScript**
* **Chrome Manifest V3**

The extension uses two different rendering approaches.

Interactive UI such as the sidebar is rendered inside a **Shadow DOM**, preventing the host website's styles from interfering with PorpoiseRead.

The grammatical annotations themselves are inserted into the webpage DOM so that analysed words remain spatially connected to the text being read.

### Dashboard

The learning dashboard is built with:

* **Next.js**
* **React**
* **TypeScript**
* **Tailwind CSS**
* **shadcn/ui**

### Backend and data

* **Supabase Auth** — authentication
* **Supabase / Postgres** — users, saved vocabulary, learning statistics and SRS state
* **Babelscape API** — NLP and morphological analysis
* **DeepL API** — translation
* **Cloudflare KV** — verb and conjugation datasets

NLP responses are cached to reduce repeated API calls for previously analysed vocabulary.

---

## Request flow

A simplified version of what happens when someone analyses text:

```text
             Webpage
                │
        User selects text
                │
                ▼
       PorpoiseRead Extension
                │
                ▼
          Next.js API
         /            \
        /              \
       ▼                ▼
Morphological NLP    Translation
   Babelscape           DeepL
       │                │
       └───────┬────────┘
               ▼
        Structured tokens
               │
               ▼
     In-page annotations +
       interactive sidebar
               │
        User saves a word
               │
               ▼
           Supabase
               │
               ▼
        Learning dashboard
               │
               ▼
          SRS reviews
```

Verb requests additionally query conjugation datasets stored in Cloudflare KV.

---

## Running locally

PorpoiseRead uses npm workspaces for the extension and dashboard.

### Clone the repository

```bash
git clone https://github.com/princhi-minchi/Read-With-Porpoise.git
cd Read-With-Porpoise
npm install
```

### Run the dashboard

```bash
cd dashboard
npm run dev
```

The development server runs at:

```text
http://localhost:3000
```

### Run the extension

In another terminal:

```bash
cd extension
npm run dev
```

Plasmo builds the development extension to:

```text
extension/.plasmo/build/chrome-mv3-dev
```

Load that directory through:

```text
chrome://extensions
```

with **Developer mode → Load unpacked**.

The project also requires API credentials and configuration for Supabase, DeepL, Babelscape and Cloudflare KV.

---

## From ConjuMate to PorpoiseRead

PorpoiseRead grew out of **[ConjuMate](https://github.com/princhi-minchi/LangHover)**, my first Chrome extension.

I originally built ConjuMate while studying in Milan because I wanted an easier way to understand Italian verb forms while reading online. It let users select Italian text on a webpage and immediately see translations and verb conjugations without leaving the page.

I submitted ConjuMate to the **Tech Europe Foundation Ignition Program** and was selected for its seven-week founder program.

Through workshops, mentoring, customer research and pitching, I started questioning the scope of the original product.

The useful part wasn't just making conjugations easier to look up.

The larger opportunity seemed to be making **real-world content itself usable for language learning**.

That led me to pivot ConjuMate into PorpoiseRead: a broader platform connecting reading, contextual language analysis, vocabulary acquisition and spaced repetition.

The repository is the current implementation of that idea.

---

## Development approach

I built PorpoiseRead using **AI coding tools extensively throughout the development process**.

That allowed me to go from product specifications and interface ideas to a working multi-part system despite not having a traditional computer-science background.

The repository includes some of the specifications and agent instructions I used to break the product into components and build it iteratively.

---

## Project status

🚧 **Prototype / active development**

The core architecture and main user flow are implemented, but PorpoiseRead is not currently presented as a production-ready consumer application.

Current work includes improving the learning interface, grammatical presentation and overall user experience.

---

## Links

* **1-minute PorpoiseRead pitch:** [YouTube](https://www.youtube.com/watch?v=Xzj8gT2izLk)
* **Pitch deck:** [Pitch Deck](./Pitch%20Deck-1.pdf)
* **ConjuMate:** [github.com/princhi-minchi/LangHover](https://github.com/princhi-minchi/LangHover)
* **ConjuMate demo + pitch:** [YouTube](https://www.youtube.com/watch?v=gRBc71vt0o0)
