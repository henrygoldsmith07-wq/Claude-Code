import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  align, benchmarkStatus, correlation, editDistance, feedback, intelligibility,
  normalise, phonemeSuspicions, runBenchmark, soundsSame, verdictFor, wordSimilarity, words,
} from '../src/lib/intelligibility.js';

describe('normalisation', () => {
  it('strips accents and punctuation', () => {
    assert.equal(normalise('Où êtes-vous ?'), 'ou etes vous');
    assert.deepEqual(words("J'ai mangé!"), ["j'ai", 'mange']);
  });
});

describe('soundsSame', () => {
  it('treats French homophone endings as identical', () => {
    assert.ok(soundsSame('mangé', 'manger'));
    assert.ok(soundsSame('parlez', 'parler'));
    assert.ok(soundsSame('parlait', 'parlais'));
  });

  it('ignores silent final consonants', () => {
    assert.ok(soundsSame('près', 'pre'));
    assert.ok(soundsSame('petit', 'peti'));
  });

  it('still separates genuinely different words', () => {
    assert.ok(!soundsSame('vin', 'vent'));
    assert.ok(!soundsSame('gare', 'car'));
    assert.ok(!soundsSame('dessus', 'dessous'));
  });
});

describe('alignment', () => {
  it('marks hits, substitutions, insertions and deletions', () => {
    const ops = align(['le', 'chat', 'noir'], ['le', 'chien', 'noir']);
    assert.equal(ops[1].type, 'substitution');
    assert.equal(ops[1].target, 'chat');

    const withInsertion = align(['le', 'chat'], ['le', 'gros', 'chat']);
    assert.ok(withInsertion.some((o) => o.type === 'insertion'));

    const withDeletion = align(['le', 'gros', 'chat'], ['le', 'chat']);
    assert.ok(withDeletion.some((o) => o.type === 'deletion'));
  });

  it('labels homophones as such rather than as errors', () => {
    const ops = align(['mange'], ['manger']);
    assert.equal(ops[0].type, 'homophone');
  });
});

describe('edit distance', () => {
  it('behaves', () => {
    assert.equal(editDistance('chat', 'chat'), 0);
    assert.equal(editDistance('chat', 'chats'), 1);
    assert.equal(editDistance('', 'abc'), 3);
    assert.equal(wordSimilarity('chat', 'chat'), 1);
  });
});

describe('intelligibility scoring', () => {
  it('scores a perfect repetition at 100', () => {
    const r = intelligibility("Je voudrais un café.", "Je voudrais un café.");
    assert.equal(r.score, 100);
    assert.equal(r.conformity, 100);
  });

  it('does not penalise a spelling artefact of the transcriber', () => {
    const r = intelligibility("J'ai mangé une pomme.", "J'ai manger une pomme.");
    assert.equal(r.score, 100, 'homophone should not cost intelligibility');
    assert.ok(r.conformity < 100, 'but conformity should notice it');
  });

  it('reports conformity separately from intelligibility', () => {
    const r = intelligibility('Je suis allé au marché.', 'Je suis aller au marche.');
    assert.ok(r.score > r.conformity, 'accent-only differences must not drag the main score');
  });

  it('costs more for a lost content word than a lost function word', () => {
    const lostContent = intelligibility('La gare est fermée.', 'La XXXX est fermée.');
    const lostFunction = intelligibility('La gare est fermée.', 'XXXX gare est fermée.');
    assert.ok(lostContent.score < lostFunction.score);
  });

  it('gives partial credit for a near miss', () => {
    const near = intelligibility('la boulangerie', 'la boulangerei');
    const far = intelligibility('la boulangerie', 'la zzzzzz');
    assert.ok(near.score > far.score);
    assert.ok(near.score > 60);
  });

  it('bottoms out at 0 for unrelated speech', () => {
    const r = intelligibility('Je suis très fatigué.', 'hello there');
    assert.equal(r.score, 0);
  });

  it('returns null rather than 0 with no target', () => {
    assert.equal(intelligibility('', 'anything').score, null);
  });

  it('does not punish extra words that do not block meaning', () => {
    const r = intelligibility('Je voudrais un café.', 'Alors euh je voudrais un café.');
    assert.equal(r.score, 100);
  });

  it('gives a verdict that matches the score', () => {
    assert.match(verdictFor(95), /easily/);
    assert.match(verdictFor(20), /Not intelligible/);
    assert.equal(verdictFor(null), null);
  });
});

describe('phoneme attribution', () => {
  it('blames the right nasal contrast', () => {
    const s = phonemeSuspicions(intelligibility('Le vin est bon.', 'Le vent est bon.'));
    assert.ok(s.some((x) => x.phonemeId.startsWith('nasal')), 'expected a nasal suspicion');
  });

  it('catches the u/ou contrast', () => {
    const s = phonemeSuspicions(intelligibility("C'est tout.", "C'est tu."));
    assert.ok(s.some((x) => x.phonemeId === 'u-ou'));
  });

  it('stays silent when the difference is a transcription artefact', () => {
    // Both words contain "ou" — nothing about that vowel went wrong, and an
    // earlier version of the rules blamed it anyway.
    const s = phonemeSuspicions(intelligibility('la boulangerie', 'la boulangeri'));
    assert.deepEqual(s, [], `spurious suspicions: ${s.map((x) => x.phonemeId).join(',')}`);
  });

  it('says nothing at all about a perfect attempt', () => {
    assert.deepEqual(phonemeSuspicions(intelligibility('Bonjour.', 'Bonjour.')), []);
  });
});

describe('feedback', () => {
  it('tells a clear-but-accented speaker to leave their accent alone', () => {
    const f = feedback('Je suis allé au marché.', 'Je suis aller au marche.');
    assert.ok(f.notes.some((n) => /accent, not error/i.test(n)));
  });

  it('names the words that did not land', () => {
    const f = feedback('La gare est fermée.', 'La zzz est fermée.');
    assert.ok(f.notes.some((n) => /did not land/i.test(n)));
  });

  it('has nothing to say about a perfect attempt', () => {
    const f = feedback('Bonjour.', 'Bonjour.');
    assert.deepEqual(f.notes, ['Nothing to fix on this one.']);
  });
});

describe('human benchmark', () => {
  it('ships empty and admits it', () => {
    const status = benchmarkStatus();
    assert.equal(status.n, 0);
    assert.equal(status.status, 'no-data');
    assert.equal(status.label, 'Unvalidated');
    assert.equal(status.correlation, null);
  });

  it('computes a correlation once real labels exist', () => {
    const items = [
      { id: '1', target: 'Bonjour.', transcript: 'Bonjour.', humanMean: 5 },
      { id: '2', target: 'Je suis fatigué.', transcript: 'Je suis fatigué.', humanMean: 5 },
      { id: '3', target: 'La gare est fermée.', transcript: 'zzz zzz zzz zzz', humanMean: 1 },
      { id: '4', target: 'Le vin est bon.', transcript: 'Le vent est bon.', humanMean: 3 },
    ];
    const result = runBenchmark(items);
    assert.equal(result.n, 4);
    assert.equal(result.status, 'provisional', 'four items is not validation');
    assert.ok(result.correlation > 0.8, `weak correlation: ${result.correlation}`);
    assert.ok(result.meanAbsoluteError !== null);
  });

  it('ignores unlabelled items', () => {
    assert.equal(runBenchmark([{ id: 'x', target: 'a' }]).n, 0);
  });

  it('needs three points before claiming a correlation', () => {
    assert.equal(correlation([[1, 2], [3, 4]]), null);
    assert.equal(correlation([[1, 1], [2, 2], [3, 3]]), 1);
  });
});
