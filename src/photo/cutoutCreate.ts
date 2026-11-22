import { CUTOUT_COPY } from "./cutoutCopy.ts";
import type { CutoutChanges, CutoutSource, CutoutSubject, CutoutTarget } from "./cutoutTypes.ts";

export type CutoutPickButton = "pick" | "everyone";
export type CutoutAttempt = "create" | "first-pick" | "replace-pick" | "edit";
export type CutoutNextStep = "attach" | "replace" | "enter-pick" | "retry-pick" | "keep-previous";

// 종류가 없는 1단계 스티커는 사람으로 읽습니다.
export function getCutoutSubject(source: Pick<CutoutSource, "subject">): CutoutSubject {
  return source.subject ?? "person";
}

// 처음 만들 때의 대상입니다. 사람은 모두, 반려동물·물건은 사진 전체의 가운데 점입니다(설계 4.3).
export function getStartTarget(subject: CutoutSubject): CutoutTarget {
  if (subject === "thing") return { kind: "point", x: 0.5, y: 0.5 };
  return { kind: "everyone" };
}

// '처음부터 다시'의 변경입니다. 종류는 바꾸지 않으므로 결과에 넣지 않습니다(설계 4.5 끝).
export function getRestartChanges(source: Pick<CutoutSource, "subject">): Required<CutoutChanges> {
  return { target: getStartTarget(getCutoutSubject(source)), outline: true, eraseStrokes: [] };
}

// 다듬기 카드의 고르기 버튼입니다. '사람 모두'는 사람을 누른 점으로 만든 스티커에만 보입니다.
export function getCutoutPickButtons(source: Pick<CutoutSource, "subject" | "target">): CutoutPickButton[] {
  if (getCutoutSubject(source) === "person" && source.target.kind === "point") return ["pick", "everyone"];
  return ["pick"];
}

// 누끼 결과에 따라 다음에 할 일입니다(설계 4.5 표).
export function getCutoutNextStep(attempt: CutoutAttempt, found: boolean): CutoutNextStep {
  if (found) return attempt === "create" || attempt === "first-pick" ? "attach" : "replace";
  if (attempt === "create") return "enter-pick";
  if (attempt === "edit") return "keep-previous";
  return "retry-pick";
}

// 못 찾았을 때 보일 안내(Codex 필수 7). 고르기는 안내 자리 한 곳, 만들기는 첫 고르기 카드, 편집은 경고 자리에 결과를 그대로 뒀다는 문구입니다(Codex 2차 권장 2).
export function getCutoutNotFoundMessage(attempt: CutoutAttempt): string {
  if (attempt === "create") return CUTOUT_COPY.notFound;
  if (attempt === "edit") return CUTOUT_COPY.editKept;
  return CUTOUT_COPY.pickMissed;
}

// 칸 사진에서 누른 점(사진 전체 0~1). 대상만 바꾸고 종류·획·테두리는 그대로 둡니다(Codex 필수 11).
export function getPickChanges(point: { x: number; y: number }): { target: CutoutTarget } {
  return { target: { kind: "point", x: point.x, y: point.y } };
}
