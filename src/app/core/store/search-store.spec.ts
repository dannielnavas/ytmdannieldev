import { TestBed } from '@angular/core/testing';
import { SearchStore } from './search-store';

describe('SearchStore', () => {
  let store: SearchStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(SearchStore);
  });

  it('starts empty', () => {
    expect(store.result()).toBeNull();
  });

  it('stores the last search result', () => {
    const result = {
      songs: [],
      playlists: [],
      artists: [],
      albums: [],
    };

    store.set(result);

    expect(store.result()).toBe(result);
  });

  it('replaces a previous result instead of merging', () => {
    store.set({
      songs: [],
      playlists: [],
      artists: [],
      albums: [],
    });
    const second = { songs: [], playlists: [], artists: [], albums: [] };

    store.set(second);

    expect(store.result()).toBe(second);
  });

  it('clears back to null', () => {
    store.set({ songs: [], playlists: [], artists: [], albums: [] });

    store.clear();

    expect(store.result()).toBeNull();
  });
});
