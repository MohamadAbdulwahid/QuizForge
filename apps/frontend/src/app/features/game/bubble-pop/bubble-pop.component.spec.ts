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
    // Tests opt out of the 3-2-1 countdown so clicks work immediately
    // (fake timers would otherwise leave the component stuck in countdown).
    fixture.componentRef.setInput('skipCountdown', true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Rendering ──

  it('renders 6 bubbles when input is provided', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.debugElement.queryAll(By.css('.br-bubble'));
    expect(buttons.length).toBe(6);
  });

  it('renders 6 bubbles from internal generation when no input provided', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.debugElement.queryAll(By.css('.br-bubble'));
    expect(buttons.length).toBe(6);
  });

  it('shows "click 1 to start" instruction before any click', async () => {
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

    for (let n = 1; n <= 6; n++) {
      clickBubble(fixture, n);
      fixture.detectChanges();
    }
    await fixture.whenStable();

    // With fake timers, the timer interval won't advance, but the
    // component should still mark complete and emit the event.
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

    clickBubble(fixture, 1);
    fixture.detectChanges();
    await fixture.whenStable();

    clickBubble(fixture, 3);
    fixture.detectChanges();
    await fixture.whenStable();

    const bubble2 = findBubble(fixture, 2);
    const bubble3 = findBubble(fixture, 3);

    expect(bubble2.classes['shaking']).toBe(true);
    expect(bubble3.classes['shaking']).toBe(true);
  });

  it('resets all bubbles to unpopped after shake timeout', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    clickBubble(fixture, 1);
    fixture.detectChanges();

    clickBubble(fixture, 3);
    fixture.detectChanges();

    vi.advanceTimersByTime(500);
    fixture.detectChanges();
    await fixture.whenStable();

    const allButtons = fixture.debugElement.queryAll(By.css('.br-bubble'));
    for (const btn of allButtons) {
      expect(btn.classes['popped']).toBeFalsy();
      expect(btn.classes['shaking']).toBeFalsy();
    }

    expect(component['nextExpectedNumber']()).toBe(1);
  });

  // ── Edge cases ──

  it('ignores clicks on already-popped bubbles', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    clickBubble(fixture, 1);
    fixture.detectChanges();
    await fixture.whenStable();

    clickBubble(fixture, 1);
    fixture.detectChanges();
    await fixture.whenStable();

    const bubble1 = findBubble(fixture, 1);
    expect(bubble1.classes['popped']).toBe(true);
    expect(component['nextExpectedNumber']()).toBe(2);
  });

  it('ignores clicks during wrong-reset animation', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.detectChanges();
    await fixture.whenStable();

    clickBubble(fixture, 1);
    fixture.detectChanges();

    clickBubble(fixture, 3);
    fixture.detectChanges();

    clickBubble(fixture, 2);
    fixture.detectChanges();
    await fixture.whenStable();

    const bubble2 = findBubble(fixture, 2);
    expect(bubble2.classes['shaking']).toBe(true);
    expect(bubble2.classes['popped']).toBeFalsy();
  });

  it('does not start countdown when skipCountdown is true', async () => {
    fixture.componentRef.setInput('bubbles', makeBubbles());
    fixture.componentRef.setInput('skipCountdown', true);
    fixture.detectChanges();
    await fixture.whenStable();

    // With skipCountdown=true, phase is 'waiting' immediately, not 'countdown'.
    expect(component['phase']()).toBe('waiting');
  });

  it('starts countdown when skipCountdown is false', async () => {
    // Recreate the fixture so ngOnInit runs with skipCountdown=false.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BubblePopComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    const freshFixture = TestBed.createComponent(BubblePopComponent);
    freshFixture.componentRef.setInput('bubbles', makeBubbles());
    freshFixture.componentRef.setInput('skipCountdown', false);
    freshFixture.detectChanges();
    await freshFixture.whenStable();

    expect(freshFixture.componentInstance['phase']()).toBe('countdown');
  });
});

// ── Test helpers ──

function findBubble(
  fixture: ComponentFixture<BubblePopComponent>,
  num: number
): { classes: Record<string, boolean>; nativeElement: HTMLElement } {
  const buttons = fixture.debugElement.queryAll(By.css('.br-bubble'));
  const found = buttons.find(
    (btn) => btn.nativeElement.textContent.trim() === String(num)
  );
  if (!found) {
    throw new Error(`Bubble ${num} not found in DOM`);
  }
  return { classes: found.classes, nativeElement: found.nativeElement as HTMLElement };
}

function clickBubble(fixture: ComponentFixture<BubblePopComponent>, num: number): void {
  const { nativeElement } = findBubble(fixture, num);
  nativeElement.click();
}
