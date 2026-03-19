import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCategorySelectionOutcome,
  getFrameSelectionDecision,
  normalizeFrameType,
} from '../.tmp-tests/utils/frameChangeFlow.js';

test('편집 내용이 있으면 프레임 변경 전에 확인이 필요하다', () => {
  const decision = getFrameSelectionDecision({
    rawFrameType: '4v_2',
    selectedFrame: '1l',
    hasContent: true,
  });

  assert.deepEqual(decision, {
    kind: 'confirm',
    frameType: '4v_2',
  });
});

test('옵션이 하나뿐인 카테고리도 우선 갤러리 상태를 유지한다', () => {
  const outcome = getCategorySelectionOutcome({
    selectedCategory: null,
    category: '9컷',
    options: ['9v_1'],
  });

  assert.deepEqual(outcome, {
    nextCategory: '9컷',
    nextCanvasMode: 'gallery',
    autoSelectFrame: null,
  });
});

test('옛 프레임 이름은 새 프레임 이름으로 정규화된다', () => {
  assert.equal(normalizeFrameType('2v'), '2v_1');
  assert.equal(normalizeFrameType('4v'), '4v_1');
  assert.equal(normalizeFrameType('6v'), '6v_1');
  assert.equal(normalizeFrameType('9v'), '9v_1');
});
