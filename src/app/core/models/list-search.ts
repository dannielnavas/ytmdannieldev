export interface IListSearch {
  songs: Song[];
  playlists: Playlist[];
  artists: Artist2[];
  albums: Album2[];
}

export interface Album2 {
  type: string;
  albumId: string;
  playlistId: string;
  artist: Artist3;
  year: number;
  name: string;
  thumbnails: Thumbnail[];
}

export interface Artist3 {
  name: string;
  artistId: null | string;
}

export interface Artist2 {
  type: string;
  artistId: string;
  name: string;
  thumbnails: Thumbnail[];
}

export interface Playlist {
  type: string;
  playlistId: string;
  name: string;
  artist: Artist;
  thumbnails: Thumbnail[];
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

export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

export interface Album {
  name: string;
  albumId: string;
}

export interface Artist {
  name: string;
  artistId: string;
}
