import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCategorySelectionOutcome,
  getFrameSelectionDecision,
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
    options: ['9v'],
  });

  assert.deepEqual(outcome, {
    nextCategory: '9컷',
    nextCanvasMode: 'gallery',
    autoSelectFrame: '9v',
  });
});
