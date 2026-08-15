import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARDS, CRITERIA, TASK_CRITERIA, TIER, bandFor, boardList, getBoard, specCaveat,
  targetSeconds, taskMarks,
} from '../src/lib/exams/boards.js';
import {
  PHASE, EXAMINER_SCRIPTS, REAL_RESULTS, beginPrep, beginSpeaking, benchmarkExaminer,
  buildPaper, cohensKappa, completeSection, examFeedback, gradeEstimate, initRun, isExpired,
  notesAllowed, phaseAllowance, scorePaper, scoreTask, timeLeft, validateAgainstResults,
} from '../src/lib/exams/simulator.js';
import {
  CONVERSATIONS, PHOTOCARDS, READING_PASSAGES, ROLEPLAYS, availableThemes,
  pickPhotocard, pickRoleplay, taskBankStats,
} from '../src/lib/exams/tasks.js';
import { benchmarkExam } from '../src/lib/examBenchmark.js';

describe('board specifications', () => {
  it('every board declares where to verify its timings', () => {
    for (const b of boardList()) {
      assert.ok(b.verifyAt && b.verifyAt.length > 5, `${b.id} has no verification pointer`);
      assert.ok(b.specVersion, `${b.id} has no spec version`);
      assert.match(specCaveat(b.id), /verify/i);
    }
  });

  it('every task has a timing and a mark allocation for each tier', () => {
    for (const b of boardList()) {
      const tiers = b.tiers.length ? b.tiers : [TIER.HIGHER];
      for (const task of b.tasks) {
        for (const tier of tiers) {
          assert.ok(targetSeconds(b.id, task.id, tier) > 0, `${b.id}/${task.id}/${tier} timing`);
          assert.ok(taskMarks(b.id, task.id, tier) > 0, `${b.id}/${task.id}/${tier} marks`);
        }
      }
    }
  });

  it('every task maps to criteria that exist', () => {
    for (const b of boardList()) {
      for (const task of b.tasks) {
        const criteria = TASK_CRITERIA[task.id];
        assert.ok(criteria?.length, `${task.id} has no criteria`);
        for (const c of criteria) assert.ok(CRITERIA[c], `unknown criterion ${c}`);
      }
    }
  });

  it('pronunciation is judged on clarity, not on sounding native', () => {
    const top = CRITERIA.pronunciation.bands.slice(-1)[0];
    assert.match(CRITERIA.pronunciation.blurb, /accent is not penalised/i);
    assert.match(top.desc, /accent is fine/i);
  });

  it('bands resolve for any score in range', () => {
    for (const id of Object.keys(CRITERIA)) {
      for (const score of [0, 25, 50, 75, 100]) {
        const band = bandFor(id, score);
        assert.ok(band?.label, `${id}@${score}`);
      }
    }
    assert.equal(bandFor('nope', 50), null);
    assert.equal(bandFor('accuracy', NaN), null);
  });

  it('covers the boards a UK learner would actually sit', () => {
    assert.ok(getBoard('wjec-gcse'));
    assert.ok(getBoard('wjec-alevel'));
    assert.ok(getBoard('aqa-gcse'));
    assert.ok(getBoard('edexcel-gcse'));
    assert.equal(getBoard('nonsense'), null);
  });
});

describe('task bank', () => {
  it('has material for every task type', () => {
    const stats = taskBankStats();
    assert.ok(stats.roleplays >= 4);
    assert.ok(stats.photocards >= 4);
    assert.ok(stats.conversations >= 4);
    assert.ok(stats.readingPassages >= 3);
    assert.ok(availableThemes().length >= 8);
  });

  it('every role-play has a question to ask and an unpredictable prompt', () => {
    for (const rp of ROLEPLAYS) {
      assert.equal(rp.prompts.length, 5, `${rp.id} should have five prompts`);
      assert.ok(rp.prompts.some((p) => p.ask), `${rp.id} has no "you ask" prompt`);
      const surprise = rp.prompts.find((p) => p.unpredictable);
      assert.ok(surprise, `${rp.id} has no unpredictable prompt`);
      assert.ok(surprise.examinerAsks, `${rp.id} surprise prompt has no examiner question`);
    }
  });

  it('every photo card describes a scene and demands more than one tense', () => {
    for (const pc of PHOTOCARDS) {
      assert.ok(pc.scene.length > 80, `${pc.id} scene is too thin to question`);
      const tenses = new Set(pc.questions.map((q) => q.tense).filter(Boolean));
      assert.ok(tenses.size >= 1, `${pc.id} never leaves the present tense`);
      assert.ok(pc.questions.some((q) => q.core), `${pc.id} has no opening question`);
    }
  });

  it('every conversation has follow-ups, a stretch question and a candidate question', () => {
    for (const cv of CONVERSATIONS) {
      assert.ok(cv.followUps.length >= 3, `${cv.id}`);
      assert.ok(cv.stretch, `${cv.id} has no stretch question`);
      assert.ok(cv.candidateAsks, `${cv.id} never asks the candidate to ask`);
    }
  });

  it('reading passages name the sounds they exercise', () => {
    for (const p of READING_PASSAGES) {
      assert.ok(p.focus.length > 0, `${p.id}`);
      assert.ok(p.text.length > 100, `${p.id} is too short to assess`);
    }
  });

  it('respects a theme filter and never returns nothing', () => {
    const themed = pickRoleplay({ theme: 'Travel and tourism' });
    assert.equal(themed.theme, 'Travel and tourism');
    assert.ok(pickPhotocard({ theme: 'a theme that does not exist' }), 'must fall back rather than return null');
  });

  it('honours the exclusion list', () => {
    const excluded = ROLEPLAYS.slice(0, ROLEPLAYS.length - 1).map((r) => r.id);
    const pick = pickRoleplay({ exclude: excluded });
    assert.ok(!excluded.includes(pick.id));
  });
});

describe('paper construction', () => {
  it('builds a full paper with material for every section', () => {
    const paper = buildPaper({ boardId: 'wjec-gcse', tier: TIER.HIGHER });
    assert.equal(paper.sections.length, BOARDS['wjec-gcse'].tasks.length);
    for (const s of paper.sections) {
      assert.ok(s.material, `${s.taskId} has no material`);
      assert.ok(s.seconds > 0);
    }
    assert.ok(paper.totalMarks > 0);
    assert.ok(paper.caveat.length > 0);
  });

  it('builds a single-task paper with a proportionate prep slice', () => {
    const single = buildPaper({ boardId: 'wjec-gcse', mode: 'single', taskId: 'photocard' });
    assert.equal(single.sections.length, 1);
    assert.ok(single.prepSeconds < BOARDS['wjec-gcse'].prepTotal);
  });

  it('gives higher tier more speaking time than foundation', () => {
    const higher = buildPaper({ boardId: 'wjec-gcse', tier: TIER.HIGHER });
    const foundation = buildPaper({ boardId: 'wjec-gcse', tier: TIER.FOUNDATION });
    assert.ok(higher.totalSpeakingSeconds > foundation.totalSpeakingSeconds);
  });

  it('refuses an unknown board rather than producing nonsense', () => {
    assert.throws(() => buildPaper({ boardId: 'not-a-board' }), /Unknown exam board/);
  });
});

describe('the clock', () => {
  const paper = buildPaper({ boardId: 'wjec-gcse', tier: TIER.HIGHER });

  it('counts down through prep and speaking', () => {
    const t0 = 1_000_000;
    let run = beginPrep(initRun(paper, { now: t0 }), { now: t0 });
    assert.equal(run.phase, PHASE.PREP);
    assert.equal(timeLeft(run, t0), paper.prepSeconds);
    assert.equal(timeLeft(run, t0 + 60_000), paper.prepSeconds - 60);
    assert.ok(isExpired(run, t0 + (paper.prepSeconds + 1) * 1000));

    run = beginSpeaking(run, { now: t0 });
    assert.equal(phaseAllowance(run), paper.sections[0].seconds);
  });

  it('does not go negative', () => {
    const t0 = 0;
    const run = beginPrep(initRun(paper, { now: t0 }), { now: t0 });
    assert.equal(timeLeft(run, t0 + 99_999_999), 0);
  });

  it('allows notes for the photo card but not the conversation', () => {
    let run = beginSpeaking(beginPrep(initRun(paper)));
    assert.ok(notesAllowed(run), 'notes allowed on the role-play');
    while (run.paper.sections[run.sectionIndex]?.taskId !== 'conversation' && run.phase !== PHASE.REVIEW) {
      run = completeSection(run, { transcript: 'x', spokenSeconds: 30 });
    }
    assert.equal(notesAllowed(run), false, 'notes must be forbidden in the conversation');
  });

  it('records the shortfall against the allowance', () => {
    let run = beginSpeaking(beginPrep(initRun(paper)));
    const allowance = run.paper.sections[0].seconds;
    run = completeSection(run, { transcript: 'court', spokenSeconds: 40 });
    assert.equal(run.transcripts[0].shortfall, allowance - 40);
  });

  it('reaches review after the last section', () => {
    let run = beginSpeaking(beginPrep(initRun(paper)));
    for (let i = 0; i < paper.sections.length; i += 1) {
      run = completeSection(run, { transcript: 'x', spokenSeconds: 200 });
    }
    assert.equal(run.phase, PHASE.REVIEW);
    assert.equal(run.transcripts.length, paper.sections.length);
  });
});

describe('scoring', () => {
  it('converts criterion percentages into marks', () => {
    const task = scoreTask({ boardId: 'wjec-gcse', taskId: 'roleplay', tier: TIER.HIGHER, scores: { communication: 100, accuracy: 100 } });
    assert.equal(task.marks, task.outOf);
    assert.equal(task.percent, 100);
  });

  it('reports "not scored" rather than zero when nothing was marked', () => {
    const task = scoreTask({ boardId: 'wjec-gcse', taskId: 'roleplay', scores: {} });
    assert.equal(task.marks, null);
  });

  it('lists criteria left unscored', () => {
    const task = scoreTask({ boardId: 'wjec-gcse', taskId: 'conversation', scores: { communication: 60 } });
    assert.ok(task.unscored.length > 0);
  });

  it('totals only the tasks that were scored', () => {
    const paperScore = scorePaper({
      boardId: 'wjec-gcse',
      taskScores: [
        scoreTask({ boardId: 'wjec-gcse', taskId: 'roleplay', scores: { communication: 80, accuracy: 80 } }),
        scoreTask({ boardId: 'wjec-gcse', taskId: 'photocard', scores: {} }),
      ],
    });
    assert.equal(paperScore.outOf, taskMarks('wjec-gcse', 'roleplay', TIER.HIGHER));
    assert.equal(paperScore.percent, 80);
  });
});

describe('grade estimation', () => {
  it('refuses to invent a grade without boundaries', () => {
    const g = gradeEstimate(72, { board: 'WJEC' });
    assert.equal(g.grade, null);
    assert.equal(g.confidence, null);
    assert.ok(g.indicativeBand);
    assert.match(g.note, /boundaries/i);
  });

  it('uses boundaries when the learner supplies them', () => {
    const g = gradeEstimate(72, { boundaries: { 9: 85, 8: 76, 7: 68, 6: 60 } });
    assert.equal(g.grade, '7');
    assert.ok(g.confidence > 0);
  });

  it('handles an unscored paper', () => {
    assert.equal(gradeEstimate(null).grade, null);
  });
});

describe('feedback', () => {
  it('calls out running short before anything else', () => {
    const paper = buildPaper({ boardId: 'wjec-gcse', tier: TIER.HIGHER });
    let run = beginSpeaking(beginPrep(initRun(paper)));
    run = completeSection(run, { transcript: 'trop court', spokenSeconds: 10 });
    const notes = examFeedback(run, { tasks: [] });
    assert.ok(notes.some((n) => n.kind === 'timing'));
    assert.ok(notes[0].text.includes('10s'));
  });

  it('names the weakest criterion with a next step', () => {
    const paper = buildPaper({ boardId: 'wjec-gcse', tier: TIER.HIGHER });
    let run = beginSpeaking(beginPrep(initRun(paper)));
    run = completeSection(run, { transcript: 'ok', spokenSeconds: 200 });
    const paperScore = scorePaper({
      boardId: 'wjec-gcse',
      taskScores: [scoreTask({ boardId: 'wjec-gcse', taskId: 'roleplay', scores: { communication: 80, accuracy: 30 } })],
    });
    const notes = examFeedback(run, paperScore);
    assert.ok(notes.some((n) => n.kind === 'criterion' && /Accuracy/.test(n.text)));
  });

  it('says so when nothing went wrong', () => {
    const paper = buildPaper({ boardId: 'wjec-gcse', tier: TIER.HIGHER });
    let run = beginSpeaking(beginPrep(initRun(paper)));
    run = completeSection(run, { transcript: 'ok', spokenSeconds: 1000 });
    const notes = examFeedback(run, { tasks: [] });
    assert.equal(notes[0].kind, 'ok');
  });
});

describe('examiner benchmark', () => {
  it('ships with no scripts and refuses to imply validation', () => {
    assert.equal(EXAMINER_SCRIPTS.length, 0);
    const b = benchmarkExaminer();
    assert.equal(b.n, 0);
    assert.equal(b.status, 'no-data');
    assert.equal(b.agreement, null);
    assert.equal(b.kappa, null);
    assert.match(b.message, /not a predicted grade/i);
  });

  it('the old benchmarkExam entry point no longer fabricates agreement', () => {
    const b = benchmarkExam();
    assert.equal(b.n, 0);
    assert.equal(b.kappa, null);
  });

  it('computes real agreement once marked attempts exist', () => {
    const scripts = Array.from({ length: 40 }, (_, i) => ({
      id: `s${i}`, appPercent: 60 + (i % 5), examinerPercent: 62 + (i % 5),
    }));
    const b = benchmarkExaminer(scripts);
    assert.equal(b.n, 40);
    assert.equal(b.status, 'benchmarked');
    assert.equal(b.meanAbsoluteError, 2);
    assert.equal(b.agreement, 1);
  });

  it('stays provisional below thirty attempts', () => {
    const b = benchmarkExaminer([{ id: 'a', appPercent: 70, examinerPercent: 70 }]);
    assert.equal(b.status, 'provisional');
    assert.match(b.message, /too few/i);
  });

  it('corrects kappa for chance agreement', () => {
    // Both raters always say the same thing — no information, so kappa is not 1.
    assert.equal(cohensKappa([['7', '7'], ['7', '7'], ['7', '7']]), null);
    // Perfect agreement across two labels is genuine.
    assert.equal(cohensKappa([['7', '7'], ['4', '4'], ['7', '7'], ['4', '4']]), 1);
    // Complete disagreement.
    assert.ok(cohensKappa([['7', '4'], ['4', '7'], ['7', '4'], ['4', '7']]) < 0);
  });
});

describe('real result validation', () => {
  it('ships empty', () => {
    assert.equal(REAL_RESULTS.length, 0);
    assert.equal(validateAgainstResults().status, 'no-data');
  });

  it('reports exact and within-one-grade accuracy', () => {
    const v = validateAgainstResults([
      { predictedGrade: '7', actualGrade: '7' },
      { predictedGrade: '6', actualGrade: '7' },
      { predictedGrade: '4', actualGrade: '8' },
    ]);
    assert.equal(v.n, 3);
    assert.ok(Math.abs(v.exact - 1 / 3) < 0.01);
    assert.ok(Math.abs(v.withinOne - 2 / 3) < 0.01);
  });
});
