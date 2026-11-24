import { createSignal, onCleanup } from "solid-js";
import type { CardPlacement } from "./boards-model";

const MOUSE_THRESHOLD = 4;
const TOUCH_THRESHOLD = 8;
const LONG_PRESS_MS = 220;
const EDGE = 56;
const MAX_SCROLL = 18;

export interface BoardDragState {
  cardId: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  target: CardPlacement | null;
}

export interface BoardDragOptions {
  scroller: () => HTMLElement | undefined;
  enabled: () => boolean;
  onDrop: (cardId: string, placement: CardPlacement) => void;
  onCancel: () => void;
}

interface Pending {
  pointerId: number;
  cardId: string;
  element: HTMLElement;
  startX: number;
  startY: number;
  touch: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
}

function closestElement(start: Element | null, selector: string): HTMLElement | null {
  const found = start?.closest(selector) ?? null;
  return found instanceof HTMLElement ? found : null;
}

function targetAt(x: number, y: number, cardId: string): CardPlacement | null {
  const column = closestElement(document.elementFromPoint(x, y), "[data-board-column]");
  const columnId = column?.getAttribute("data-board-column") ?? undefined;
  if (column === null || columnId === undefined) return null;
  for (const element of column.querySelectorAll<HTMLElement>("[data-board-card]")) {
    const id = element.getAttribute("data-board-card") ?? undefined;
    if (id === undefined || id === cardId) continue;
    const rect = element.getBoundingClientRect();
    if (y < rect.top + rect.height / 2) return { columnId, beforeCardId: id };
  }
  return { columnId, beforeCardId: null };
}

function edgeSpeed(position: number, start: number, end: number): number {
  if (position < start + EDGE) return -Math.ceil((MAX_SCROLL * (start + EDGE - position)) / EDGE);
  if (position > end - EDGE) return Math.ceil((MAX_SCROLL * (position - (end - EDGE))) / EDGE);
  return 0;
}

/**
 * Pointer-event drag and drop for board cards. A mouse drag starts after a few
 * pixels; touch and pen start after a short press so the page still scrolls.
 */
export function createBoardDrag(options: BoardDragOptions) {
  const [drag, setDrag] = createSignal<BoardDragState | null>(null);
  let pending: Pending | undefined;
  let frame = 0;
  let suppressClickUntil = 0;
  let stopListening: (() => void) | undefined;

  const blockTouchScroll = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault();
  };

  function refreshTarget(): void {
    const current = drag();
    if (current === null) return;
    const target = targetAt(current.x, current.y, current.cardId);
    const same = target?.columnId === current.target?.columnId && target?.beforeCardId === current.target?.beforeCardId;
    if (!same) setDrag({ ...current, target });
  }

  function autoScroll(): void {
    frame = 0;
    const current = drag();
    if (current === null) return;
    const scroller = options.scroller();
    let moved = false;
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      const horizontal = edgeSpeed(current.x, rect.left, rect.right);
      if (horizontal !== 0) {
        const before = scroller.scrollLeft;
        scroller.scrollLeft += horizontal;
        moved = moved || scroller.scrollLeft !== before;
      }
    }
    const body = closestElement(document.elementFromPoint(current.x, current.y), "[data-board-column-body]");
    if (body) {
      const rect = body.getBoundingClientRect();
      const vertical = edgeSpeed(current.y, rect.top, rect.bottom);
      if (vertical !== 0) {
        const before = body.scrollTop;
        body.scrollTop += vertical;
        moved = moved || body.scrollTop !== before;
      }
    }
    if (moved) refreshTarget();
    frame = requestAnimationFrame(autoScroll);
  }

  function finish(): void {
    if (pending?.timer !== undefined) clearTimeout(pending.timer);
    pending = undefined;
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    stopListening?.();
    stopListening = undefined;
    window.removeEventListener("touchmove", blockTouchScroll);
    document.documentElement.classList.remove("boards-dragging");
    setDrag(null);
  }

  function activate(event: { clientX: number; clientY: number }): void {
    const current = pending;
    if (current === undefined || drag() !== null) return;
    if (current.timer !== undefined) clearTimeout(current.timer);
    current.timer = undefined;
    const rect = current.element.getBoundingClientRect();
    document.documentElement.classList.add("boards-dragging");
    window.addEventListener("touchmove", blockTouchScroll, { passive: false });
    setDrag({
      cardId: current.cardId,
      x: event.clientX,
      y: event.clientY,
      offsetX: current.startX - rect.left,
      offsetY: current.startY - rect.top,
      width: rect.width,
      height: rect.height,
      target: targetAt(event.clientX, event.clientY, current.cardId),
    });
    frame = requestAnimationFrame(autoScroll);
  }

  function begin(event: PointerEvent, cardId: string, element: HTMLElement): void {
    if (!options.enabled() || pending !== undefined || drag() !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!event.isPrimary) return;
    const touch = event.pointerType !== "mouse";
    const started: Pending = {
      pointerId: event.pointerId,
      cardId,
      element,
      startX: event.clientX,
      startY: event.clientY,
      touch,
      timer: undefined,
    };
    pending = started;
    if (touch) {
      started.timer = setTimeout(() => activate({ clientX: started.startX, clientY: started.startY }), LONG_PRESS_MS);
    }
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== started.pointerId) return;
      const current = drag();
      if (current === null) {
        const distance = Math.hypot(moveEvent.clientX - started.startX, moveEvent.clientY - started.startY);
        if (started.touch && distance > TOUCH_THRESHOLD) finish();
        else if (!started.touch && distance > MOUSE_THRESHOLD) activate(moveEvent);
        return;
      }
      if (moveEvent.cancelable) moveEvent.preventDefault();
      setDrag({ ...current, x: moveEvent.clientX, y: moveEvent.clientY });
      refreshTarget();
    };
    const up = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== started.pointerId) return;
      const current = drag();
      if (current !== null) {
        suppressClickUntil = Date.now() + 250;
        const target = targetAt(upEvent.clientX, upEvent.clientY, current.cardId) ?? current.target;
        finish();
        if (target === null) options.onCancel();
        else options.onDrop(current.cardId, target);
        return;
      }
      finish();
    };
    const cancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== started.pointerId) return;
      abort();
    };
    const key = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape" || drag() === null) return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      abort();
    };
    const blur = () => abort();
    const abort = () => {
      const wasDragging = drag() !== null;
      if (wasDragging) suppressClickUntil = Date.now() + 250;
      finish();
      if (wasDragging) options.onCancel();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", blur);
    stopListening = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", blur);
    };
  }

  onCleanup(finish);

  return {
    drag,
    begin,
    cancel: finish,
    clickSuppressed: () => Date.now() < suppressClickUntil,
  };
}
