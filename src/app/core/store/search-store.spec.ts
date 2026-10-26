import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { SearchStore } from './search-store';
import { Dashboard } from '../services/dashboard/dashboard';

describe('SearchStore', () => {
  let store: SearchStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SearchStore],
    });
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
    expect(store.currentQuery()).toBe('');
    expect(store.isLoading()).toBe(false);
  });

  it('performs search and updates loading and result states', () => {
    const dashboard = TestBed.inject(Dashboard);
    const mockResult = { songs: [], playlists: [], artists: [], albums: [] };
    vi.spyOn(dashboard, 'searchSongs').mockReturnValue(of(mockResult as any));

    store.search('Dua Lipa').subscribe();

    expect(dashboard.searchSongs).toHaveBeenCalledWith('Dua Lipa');
    expect(store.currentQuery()).toBe('Dua Lipa');
    expect(store.result()).toBe(mockResult as any);
    expect(store.isLoading()).toBe(false);
  });
});
