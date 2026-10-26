import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  Dashboard,
  extractMixVideoId,
  isMixId,
  isVideoId,
  normalizeBrowseId,
  normalizePlaylistId,
} from './dashboard';
import { API_BASE_URL } from '../../config/api.config';
import { DashboardResponse, PersonalDashboardData } from '../../models/dashboard';

describe('Dashboard', () => {
  let service: Dashboard;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Dashboard);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('normalizeBrowseId should strip RDAM prefix', () => {
    expect(normalizeBrowseId('RDAMVM12345')).toBe('12345');
    expect(normalizeBrowseId('RDAMPLabcde')).toBe('abcde');
    expect(normalizeBrowseId('PLcustom123')).toBe('PLcustom123');
  });

  it('isVideoId should correctly validate 11-char YouTube video IDs', () => {
    expect(isVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isVideoId('4tr_IG0Xb-4')).toBe(true);
    expect(isVideoId('short')).toBe(false);
    expect(isVideoId('toolongvideoidentifier123')).toBe(false);
    expect(isVideoId(null)).toBe(false);
  });

  it('isMixId should identify YouTube Music mix and radio IDs', () => {
    expect(isMixId('RDAMVMdQw4w9WgXcQ')).toBe(true);
    expect(isMixId('RDTMAK5uy_abc')).toBe(true);
    expect(isMixId('RDCLAK5uy_def')).toBe(true);
    expect(isMixId('RDEMxyz')).toBe(true);
    expect(isMixId('PL1234567890')).toBe(false);
    expect(isMixId('VLPL1234567890')).toBe(false);
  });

  it('extractMixVideoId should extract video ID from RDAMVM mix', () => {
    expect(extractMixVideoId('RDAMVMdQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractMixVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractMixVideoId('RDTMAK5uy_abc')).toBeNull();
    expect(extractMixVideoId('')).toBeNull();
  });

  it('normalizePlaylistId should format playlist IDs properly', () => {
    expect(normalizePlaylistId('RDAMPLPL123')).toBe('PL123');
    expect(normalizePlaylistId('RDAMPLabc')).toBe('PLabc');
    expect(normalizePlaylistId('PLcustom')).toBe('PLcustom');
  });

  it('getDashboard should call /dashboard with query options', () => {
    const mockResponse: DashboardResponse = {
      hasPersonalData: true,
      activeView: 'personal',
      personal: {
        kpis: {
          totalLikes: 10,
          totalDurationSeconds: 1800,
          totalMinutes: 30,
          totalHours: 0.5,
          uniqueArtists: 4,
          favoriteArtist: 'Daft Punk',
        },
        topArtists: [],
        topGenres: [],
        recentLikes: [],
        recommendations: [],
      },
      youtube: [],
    };

    service.getDashboard({ includeYoutube: true, refresh: false }).subscribe((res) => {
      expect(res.hasPersonalData).toBe(true);
      expect(res.activeView).toBe('personal');
    });

    const req = httpTesting.expectOne(
      (r) =>
        r.url === `${API_BASE_URL}/dashboard` &&
        r.params.get('includeYoutube') === 'true' &&
        r.params.get('refresh') === 'false',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('getDashboardSummary should call /dashboard/summary', () => {
    const mockResponse: DashboardResponse = {
      hasPersonalData: false,
      activeView: 'youtube',
      personal: null,
      youtube: [{ title: 'Música recomendada', contents: [] }],
    };

    service.getDashboardSummary().subscribe((res) => {
      expect(res.hasPersonalData).toBe(false);
      expect(res.activeView).toBe('youtube');
    });

    const req = httpTesting.expectOne(`${API_BASE_URL}/dashboard/summary`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('getPersonalDashboard should call /dashboard/personal', () => {
    const mockPersonal: PersonalDashboardData = {
      kpis: {
        totalLikes: 25,
        totalDurationSeconds: 6000,
        totalMinutes: 100,
        totalHours: 1.6,
        uniqueArtists: 8,
        favoriteArtist: 'Justice',
      },
      topArtists: [
        {
          name: 'Justice',
          likesCount: 12,
          totalDurationSeconds: 3000,
          imageUrl: 'https://img.test/justice.jpg',
        },
      ],
      topGenres: [{ genre: 'Electronic', weight: 40, percentage: 50 }],
      recentLikes: [],
      recommendations: [],
    };

    service.getPersonalDashboard().subscribe((data) => {
      expect(data.kpis.totalLikes).toBe(25);
      expect(data.topArtists[0].name).toBe('Justice');
    });

    const req = httpTesting.expectOne(`${API_BASE_URL}/dashboard/personal`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPersonal);
  });

  it('getYoutubeDashboard should call /youtube/dashboard', () => {
    service.getYoutubeDashboard().subscribe((data) => {
      expect(data.length).toBe(1);
    });

    const req = httpTesting.expectOne(`${API_BASE_URL}/youtube/dashboard`);
    expect(req.request.method).toBe('GET');
    req.flush([{ title: 'Pop Trends', contents: [] }]);
  });
});
