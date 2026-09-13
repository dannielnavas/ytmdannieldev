export interface PlaylistModel {
  infoPlaylist: InfoPlaylist;
  songsList: SongsList[];
}

export interface SongsList {
  type: string;
  videoId: string;
  name: string;
  artist: Artist2;
  duration: number;
  thumbnails: Thumbnail[];
}

interface Artist2 {
  name: string;
  artistId: null | string;
}

export interface InfoPlaylist {
  type: string;
  playlistId: string;
  name: string;
  artist: Artist;
  videoCount: number;
  thumbnails: Thumbnail[];
}

interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

interface Artist {
  name: string;
  artistId: null;
}
