# Guess the Language 🌍 (road-trip edition)

Static web game: a casual conversational sentence is **spoken aloud** (pre-generated Grok voice mp3s in `audio/`),
players shout which language it is, and a passenger taps the first correct player's button.

- 57 languages · 227 sentences (`data/languages.json`)
- Points by hints used: 3 / 2 / 1 / ½ · Hints: continent → history fact → another sentence (played aloud) · Reveal anytime
- Players, scores, Undo, and the "Show phrase text" toggle are saved in the browser (localStorage)
- Soft client-side password gate (static site; not real security)
