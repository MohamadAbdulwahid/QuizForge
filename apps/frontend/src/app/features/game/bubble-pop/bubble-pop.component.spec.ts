import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { BubbleData, BubblePopComponent } from './bubble-pop.component';

/**
 * Unit tests for BubblePopComponent.
 * Covers: rendering, correct click sequence, wrong-click reset,
 * completion event, and timer behaviour.
 */

function makeBubbles(): readonly BubbleData[] {
  return [
    { number: 1, x: 25, y: 25 },
    { number: 2, x: 65, y: 20 },
    { number: 3, x: 45, y: 55 },
    { number: 4, x: 75, y: 60 },
    { number: 5, x: 20, y: 70 },
    { number: 6, x: 55, y: 80 },
  ];
}

describe('BubblePopComponent', () => {
  let component: BubblePopComponent;
  let fixture: ComponentFixture<BubblePopComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [BubblePopComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(BubblePopComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Rendering ──

  it('renders 6 bubbles when input is provided', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.debugElement.queryAll(By.css('.bubble-btn'));
    expect(buttons.length).toBe(6);
  });

  it('renders 6 bubbles from internal generation when no input provided', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.debugElement.queryAll(By.css('.bubble-btn'));
    expect(buttons.length).toBe(6);
  });

  it('shows instruction text before any click', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    const hostEl: HTMLElement = fixture.nativeElement;
    expect(hostEl.textContent).toContain('1 to 6');
  });

  // ── Correct click sequence ──

  it('pops bubble 1 on correct first click', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    clickBubble(fixture, 1);
    fixture.detectChanges();
    await fixture.whenStable();

    const bubble1 = findBubble(fixture, 1);
    expect(bubble1.classes['popped']).toBe(true);
  });

  it('completes challenge when all 6 are clicked in order', async () => {
    const completeSpy = vi.fn();
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    component.challengeComplete.subscribe(completeSpy);

    // Click 1 through 6 in order
    for (let n = 1; n <= 6; n++) {
      clickBubble(fixture, n);
      fixture.detectChanges();
    }
    await fixture.whenStable();

    // Since fake timers are used, the timer interval won't advance.
    // But the component should still mark isComplete() = true and emit.
    expect(completeSpy).toHaveBeenCalledTimes(1);
  });

  it('emits bubbleClick for each correct bubble', async () => {
    const clickSpy = vi.fn();
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    component.bubbleClick.subscribe(clickSpy);

    clickBubble(fixture, 1);
    fixture.detectChanges();
    await fixture.whenStable();

    clickBubble(fixture, 2);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(clickSpy).toHaveBeenNthCalledWith(1, 1);
    expect(clickSpy).toHaveBeenNthCalledWith(2, 2);
  });

  // ── Wrong click resets ──

  it('triggers shake state on wrong click', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    // First click is correct (bubble 1)
    clickBubble(fixture, 1);
    fixture.detectChanges();
    await fixture.whenStable();

    // Click bubble 3 instead of 2 — wrong
    clickBubble(fixture, 3);
    fixture.detectChanges();
    await fixture.whenStable();

    // All non-popped bubbles should be shaking
    const bubble2 = findBubble(fixture, 2);
    const bubble3 = findBubble(fixture, 3);

    expect(bubble2.classes['shaking']).toBe(true);
    expect(bubble3.classes['shaking']).toBe(true);
  });

  it('resets all bubbles to unpopped after shake timeout', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    // Pop 1, then wrong-click 3
    clickBubble(fixture, 1);
    fixture.detectChanges();

    clickBubble(fixture, 3);
    fixture.detectChanges();

    // After the shake animation timeout (450ms)
    vi.advanceTimersByTime(500);
    fixture.detectChanges();
    await fixture.whenStable();

    // All bubbles should be back: no popped, no shaking
    const allButtons = fixture.debugElement.queryAll(By.css('.bubble-btn'));
    for (const btn of allButtons) {
      expect(btn.classes['popped']).toBeFalsy();
      expect(btn.classes['shaking']).toBeFalsy();
    }

    // Next expected should be back to 1
    expect(component['nextExpectedNumber']()).toBe(1);
  });

  // ── Edge cases ──

  it('ignores clicks on already-popped bubbles', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    // Click bubble 1 (correct)
    clickBubble(fixture, 1);
    fixture.detectChanges();
    await fixture.whenStable();

    // Click bubble 1 again (should be ignored)
    clickBubble(fixture, 1);
    fixture.detectChanges();
    await fixture.whenStable();

    // Should not have reset — bubble 1 still popped, next expected = 2
    const bubble1 = findBubble(fixture, 1);
    expect(bubble1.classes['popped']).toBe(true);
    expect(component['nextExpectedNumber']()).toBe(2);
  });

  it('ignores clicks during wrong-reset animation', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    // Pop 1, then wrong-click 3
    clickBubble(fixture, 1);
    fixture.detectChanges();

    clickBubble(fixture, 3);
    fixture.detectChanges();

    // While shaking, click bubble 2 (should be ignored)
    clickBubble(fixture, 2);
    fixture.detectChanges();
    await fixture.whenStable();

    // Bubble 2 should still be shaking (not popped)
    const bubble2 = findBubble(fixture, 2);
    expect(bubble2.classes['shaking']).toBe(true);
    expect(bubble2.classes['popped']).toBeFalsy();
  });
});

// ── Test helpers ──

function findBubble(
  fixture: ComponentFixture<BubblePopComponent>,
  num: number
): { classes: Record<string, boolean>; nativeElement: HTMLElement } {
  const buttons = fixture.debugElement.queryAll(By.css('.bubble-btn'));
  const found = buttons.find((btn) => btn.nativeElement.textContent.trim() === String(num));
  if (!found) {
    throw new Error(`Bubble ${num} not found in DOM`);
  }
  return { classes: found.classes, nativeElement: found.nativeElement as HTMLElement };
}

function clickBubble(fixture: ComponentFixture<BubblePopComponent>, num: number): void {
  const { nativeElement } = findBubble(fixture, num);
  nativeElement.click();
}
