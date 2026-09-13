export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

export interface ArtistReference {
  name: string;
  artistId: string | null;
}

export interface AlbumReference {
  name: string;
  albumId: string;
}

export interface DashboardAlbumItem {
  type: 'ALBUM';
  albumId?: string | null;
  playlistId: string;
  name: string;
  artist: ArtistReference;
  year?: number | string | null;
  thumbnails: Thumbnail[];
}

export interface DashboardPlaylistItem {
  type: 'PLAYLIST';
  playlistId: string;
  name: string;
  artist: ArtistReference;
  thumbnails: Thumbnail[];
}

export interface DashboardSongItem {
  type: 'SONG';
  videoId?: string;
  name: string;
  artist: ArtistReference;
  album?: AlbumReference | null;
  duration?: number | string | null;
  thumbnails: Thumbnail[];
}

export type DashboardItem = DashboardAlbumItem | DashboardPlaylistItem | DashboardSongItem;

export interface IDashboard {
  title: string;
  contents: (DashboardItem | null)[];
}
