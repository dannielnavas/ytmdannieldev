import { TestBed } from '@angular/core/testing';
import { ThumbnailCandidate } from './thumbnail-fallback.service';
import { Thumbnail } from './thumbnail';

const BASE = 'https://lh3.googleusercontent.com/abc';
const THUMBS = [
  { url: `${BASE}=w60-h60-l90-rj`, width: 60, height: 60 },
  { url: `${BASE}=w120-h120-l90-rj`, width: 120, height: 120 },
  { url: `${BASE}=w226-h226-l90-rj`, width: 226, height: 226 },
  { url: `${BASE}=w544-h544-l90-rj`, width: 544, height: 544 },
];

function setup(thumbnails: readonly ThumbnailCandidate[], size = 800) {
  const fixture = TestBed.createComponent(Thumbnail);
  fixture.componentRef.setInput('thumbnails', thumbnails);
  fixture.componentRef.setInput('size', size);
  fixture.detectChanges();
  return fixture;
}

function srcOf(fixture: ReturnType<typeof setup>): string | null {
  return (
    (fixture.nativeElement.querySelector('img') as HTMLImageElement | null)?.getAttribute('src') ??
    null
  );
}

describe('Thumbnail', () => {
  it('never asks for more pixels than the candidate actually has', () => {
    const fixture = setup(THUMBS);
    expect(srcOf(fixture)).toBe(`${BASE}=w544-h544-l90-rj`);
  });

  it('scales down a candidate that is larger than requested', () => {
    const fixture = setup(
      [{ url: 'https://yt3.ggpht.com/xyz=s1200', width: 1200, height: 1200 }],
      400,
    );
    expect(srcOf(fixture)).toBe('https://yt3.ggpht.com/xyz=s400-c-k-c0x00ffffff-no-rj');
  });

  it('falls back to a smaller candidate when one fails', () => {
    const fixture = setup(THUMBS);
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(srcOf(fixture)).toBe(`${BASE}=w226-h226-l90-rj`);

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(srcOf(fixture)).toBe(`${BASE}=w120-h120-l90-rj`);
  });

  it('shows the placeholder once every candidate has failed', () => {
    const fixture = setup(THUMBS);
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;

    for (let i = 0; i < THUMBS.length; i++) {
      img.dispatchEvent(new Event('error'));
      fixture.detectChanges();
    }

    expect(srcOf(fixture)).toBeNull();
  });

  it('restarts from the best candidate when the list changes', () => {
    const fixture = setup(THUMBS);
    (fixture.nativeElement.querySelector('img') as HTMLImageElement).dispatchEvent(
      new Event('error'),
    );
    fixture.detectChanges();

    fixture.componentRef.setInput('thumbnails', [{ url: `${BASE}=w60-h60-l90-rj` }]);
    fixture.detectChanges();

    expect(srcOf(fixture)).toBe(`${BASE}=w60-h60-l90-rj`);
  });

  it('uses the explicit src as-is and never degrades it', () => {
    const fixture = setup(THUMBS);
    fixture.componentRef.setInput('src', 'https://example.com/cover.jpg');
    fixture.detectChanges();

    expect(srcOf(fixture)).toBe('https://example.com/cover.jpg');
    (fixture.nativeElement.querySelector('img') as HTMLImageElement).dispatchEvent(
      new Event('error'),
    );
    fixture.detectChanges();
    expect(srcOf(fixture)).toBe('https://example.com/cover.jpg');
  });

  it('renders the placeholder when there are no thumbnails', () => {
    const fixture = setup([]);
    expect(srcOf(fixture)).toBeNull();
  });
});
