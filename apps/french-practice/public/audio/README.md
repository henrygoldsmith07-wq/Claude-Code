# Real native audio — drop-in folder

The "Authentic audio" listening tracks play real recorded MP3s from this
folder. The app works without them (it falls back to TTS with a notice),
but recorded native speech is far better ear training.

Expected files:

| File | Content |
|---|---|
| `corbeau.mp3` | La Fontaine — *Le Corbeau et le Renard* (~1 min) |
| `cigale.mp3` | La Fontaine — *La Cigale et la Fourmi* (~1 min) |

## Where to get them (public domain, free)

LibriVox recordings of La Fontaine's *Fables* are read by native French
speakers and are in the public domain:

1. Go to <https://librivox.org> and search **"Fables de La Fontaine"**
   (several complete volumes exist, e.g. *Fables, Livre 1* ).
2. Download the chapter MP3s for *Le Corbeau et le Renard* (Book I, fable 2)
   and *La Cigale et la Fourmi* (Book I, fable 1).
3. Rename them `corbeau.mp3` and `cigale.mp3` and place them in this folder.
4. Rebuild/redeploy — the tracks will play the real recordings automatically.

Any other public-domain French audio can be added the same way: add a track
with an `audioSrc` in `src/lib/listening.js` pointing at a file here.

> Note: these files are not committed because the build environment used to
> assemble the app has no network access to librivox.org/archive.org. The
> player detects a missing file and falls back to TTS, so shipping without
> them is safe.
