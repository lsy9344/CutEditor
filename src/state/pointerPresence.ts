export type PointerPresence = {
  activePointerIds: Set<number>;
};

export function createPointerPresence(): PointerPresence {
  return { activePointerIds: new Set<number>() };
}

export function hasActivePointers(presence: PointerPresence): boolean {
  return presence.activePointerIds.size > 0;
}

// 첫 포인터가 눌릴 때 true를 돌려준다. 핀치의 둘째 손가락처럼 이미 제스처 중이면 false다.
export function beginPointer(presence: PointerPresence, pointerId: number): boolean {
  if (presence.activePointerIds.has(pointerId)) {
    return false;
  }

  presence.activePointerIds.add(pointerId);
  return presence.activePointerIds.size === 1;
}

// 마지막 포인터가 풀리거나 취소될 때 true를 돌려준다.
export function endPointer(presence: PointerPresence, pointerId: number): boolean {
  if (!presence.activePointerIds.delete(pointerId)) {
    return false;
  }

  return presence.activePointerIds.size === 0;
}

// 창 밖 해제·취소·포커스 상실로 끝 이벤트를 놓쳤을 때 남은 포인터를 모두 지운다.
export function resetPointers(presence: PointerPresence): boolean {
  if (presence.activePointerIds.size === 0) {
    return false;
  }

  presence.activePointerIds.clear();
  return true;
}
