export interface AlbumResponse {
  type: string;
  albumId: string;
  name: string;
  playlistId: string;
  artist: Artist;
  year: number;
  thumbnails: Thumbnail[];
  songs: Song[];
}

export interface Song {
  type: string;
  videoId: string;
  name: string;
  artist: Artist;
  album: Album;
  duration: number;
  thumbnails: Thumbnail[];
}

export interface Album {
  albumId: string;
  name: string;
}

export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

export interface Artist {
  artistId: string;
  name: string;
}

