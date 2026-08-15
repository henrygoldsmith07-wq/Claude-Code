import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCENTS, LISTENING_STAGES, availableAccents, captionPolicy, getAccent,
  listeningStage, nextListeningStage, playbackFor, resolveVoice,
} from '../src/lib/accents.js';
import { LISTENING_TRACKS, serialParts, tracksUpTo } from '../src/lib/listening.js';
import { VIDEO_GUIDE, videoGuideFor } from '../src/lib/content/listening-library.js';

const voice = (name, lang) => ({ name, lang });

describe('accent catalogue', () => {
  it('covers the francophone world, not just Paris', () => {
    const ids = ACCENTS.map((a) => a.id);
    for (const expected of ['fr-fr', 'fr-ca', 'fr-be', 'fr-ch', 'fr-af']) {
      assert.ok(ids.includes(expected), `missing ${expected}`);
    }
  });

  it('every accent carries written features that work without a matching voice', () => {
    for (const a of ACCENTS) {
      assert.ok(a.features.length >= 2, `${a.id} has too few features`);
      assert.ok(a.blurb.length > 20, `${a.id} blurb`);
    }
  });

  it('the varieties with distinct vocabulary list it', () => {
    assert.ok(getAccent('fr-ca').lexicon.length >= 5);
    assert.ok(getAccent('fr-be').lexicon.some((l) => l.qc === 'septante'));
  });

  it('falls back to standard French for an unknown id', () => {
    assert.equal(getAccent('fr-nowhere').id, 'fr-fr');
  });
});

describe('voice resolution', () => {
  it('uses an exact locale match when the device has one', () => {
    const r = resolveVoice('fr-ca', [voice('Chantal', 'fr-CA'), voice('Thomas', 'fr-FR')]);
    assert.equal(r.exact, true);
    assert.equal(r.voice.name, 'Chantal');
    assert.equal(r.fallbackNote, null);
  });

  it('admits the fallback rather than passing off a Parisian voice as Québécois', () => {
    const r = resolveVoice('fr-ca', [voice('Thomas', 'fr-FR')]);
    assert.equal(r.exact, false);
    assert.ok(r.fallbackNote, 'a fallback must be disclosed');
    assert.match(r.fallbackNote, /no Québec voice/i);
  });

  it('handles a device with no French voice at all', () => {
    const r = resolveVoice('fr-fr', [voice('Daniel', 'en-GB')]);
    assert.equal(r.voice, null);
    assert.equal(r.exact, false);
    assert.match(r.fallbackNote, /No French voice/i);
  });

  it('handles underscore locale spellings', () => {
    const r = resolveVoice('fr-ca', [voice('Nicolas', 'fr_CA')]);
    assert.equal(r.exact, true);
  });

  it('reports which accents this device can genuinely speak', () => {
    const list = availableAccents([voice('Thomas', 'fr-FR'), voice('Chantal', 'fr-CA')]);
    const exact = list.filter((a) => a.exact).map((a) => a.id);
    assert.ok(exact.includes('fr-fr'));
    assert.ok(exact.includes('fr-ca'));
    assert.ok(!exact.includes('fr-be'));
  });
});

describe('listening progression', () => {
  it('ramps speed and accent variety independently', () => {
    const first = listeningStage(1);
    const last = listeningStage(LISTENING_STAGES.length);
    assert.ok(last.rate > first.rate);
    assert.ok(last.accents.length > first.accents.length);
  });

  it('advances on strong comprehension and drops only on weak', () => {
    assert.equal(nextListeningStage(2, 90), 3);
    assert.equal(nextListeningStage(2, 70), 2, 'one middling score should not move you');
    assert.equal(nextListeningStage(2, 30), 1);
  });

  it('clamps at both ends', () => {
    assert.equal(nextListeningStage(1, 10), 1);
    assert.equal(nextListeningStage(LISTENING_STAGES.length, 100), LISTENING_STAGES.length);
    assert.equal(nextListeningStage(0, 50), 1, 'a missing stage defaults to the first');
  });

  it('picks a deterministic accent per track so learners meet a spread', () => {
    const a = playbackFor(5, 'pod-paris');
    const b = playbackFor(5, 'pod-paris');
    assert.equal(a.accentId, b.accentId, 'must be stable for the same track');
    const spread = new Set(LISTENING_TRACKS.map((t) => playbackFor(5, t.id).accentId));
    assert.ok(spread.size > 1, 'stage 5 should not serve one accent to everything');
  });

  it('keeps the rate inside what the speech engine accepts', () => {
    for (const stage of LISTENING_STAGES) {
      for (const t of LISTENING_TRACKS) {
        const p = playbackFor(stage.id, t.id);
        assert.ok(p.rate >= 0.5 && p.rate <= 1.5, `${stage.id}/${t.id} → ${p.rate}`);
      }
    }
  });
});

describe('caption policy', () => {
  it('shows transcripts to beginners and hides them from advanced learners', () => {
    assert.equal(captionPolicy(0).show, 'immediate');
    assert.equal(captionPolicy(0.5).show, 'after-first');
    assert.equal(captionPolicy(0.9).show, 'on-request');
  });
});

describe('listening library', () => {
  it('has every kind the hub advertises', () => {
    const kinds = new Set(LISTENING_TRACKS.map((t) => t.kind));
    for (const expected of ['story', 'podcast', 'dialogue', 'news']) {
      assert.ok(kinds.has(expected), `no ${expected} tracks`);
    }
  });

  it('every track has lines, a level and a quiz', () => {
    for (const t of LISTENING_TRACKS) {
      assert.ok(t.lines?.length >= 4, `${t.id} is too short`);
      assert.ok(t.cefr, `${t.id} has no level`);
      assert.ok(t.questions?.length >= 2, `${t.id} has no comprehension check`);
      for (const q of t.questions) {
        assert.ok(q.answer >= 0 && q.answer < q.options.length, `${t.id} bad answer index`);
      }
    }
  });

  it('every line is translated', () => {
    for (const t of LISTENING_TRACKS) {
      for (const line of t.lines) {
        assert.ok(line.fr && line.en, `${t.id} has an untranslated line`);
      }
    }
  });

  it('has unique ids', () => {
    const ids = LISTENING_TRACKS.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('serialises a story in order', () => {
    const parts = serialParts('la-valise');
    assert.equal(parts.length, 3);
    assert.deepEqual(parts.map((p) => p.part), [1, 2, 3]);
  });

  it('filters tracks by level for the path engine', () => {
    const a2 = tracksUpTo('A2');
    assert.ok(a2.length > 0);
    assert.ok(a2.every((t) => ['A1', 'A2'].includes(t.cefr)));
    assert.ok(tracksUpTo('C1').length > a2.length);
  });
});

describe('video guidance', () => {
  it('recommends sources by level without embedding dead links', () => {
    assert.ok(VIDEO_GUIDE.length >= 8);
    for (const v of VIDEO_GUIDE) {
      assert.ok(v.why.length > 20, `${v.name} needs a reason`);
      assert.ok(!/https?:\/\//.test(JSON.stringify(v)), 'no URLs — they rot in an offline app');
    }
    assert.ok(videoGuideFor('B1').length >= 1);
    assert.equal(videoGuideFor('Z9').length, 0);
  });
});
