/**
 * Modelos canónicos de YouTube.
 *
 * Antes cada endpoint traía su propia copia: `Thumbnail` estaba declarado 4 veces
 * y `Artist` 4 veces con 3 criterios distintos de nullability, lo que obligaba a
 * castear `as any` en la mitad de los componentes. Estos tipos son la única
 * fuente de verdad; los archivos de modelo por endpoint los reexportan.
 */

export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

export interface Artist {
  name: string;
  /** `null` en respuestas de playlist, string en las de álbum. */
  artistId: string | null;
}

export interface Album {
  albumId: string;
  name: string;
}

/**
 * Contrato mínimo que cualquier canción debe cumplir para entrar en la cola o
 * mostrarse en la lista. Lo cumplen `Song`, `SongsList` y `DashboardSongItem`.
 */
export interface SourceSong {
  videoId: string;
  name: string;
  artist?: Artist | null;
  duration?: number | string | null;
  thumbnails?: Thumbnail[] | null;
}

export interface Song extends SourceSong {
  type: string;
  album?: Album | null;
}

/**
 * Una canción que todavía no está limpia para la cola: el backend no siempre
 * incluye `videoId` (p. ej. en los items de álbum del dashboard), así que
 * `toQueueItems()` las descarta en vez de confiar en el tipo.
 */
export type QueueCandidate = Omit<SourceSong, 'videoId'> & { videoId?: string | null };

/** Respuesta de `/youtube/album/:id`. */
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

/** Respuesta de `/youtube/playlist/:id`. */
export interface PlaylistModel {
  infoPlaylist: InfoPlaylist;
  songsList: Song[];
}

export interface InfoPlaylist {
  type: string;
  playlistId: string;
  name: string;
  artist: Artist;
  videoCount: number;
  thumbnails: Thumbnail[];
}

/** Respuesta de `/youtube/search?q=`. */
export interface IListSearch {
  songs: Song[];
  playlists: SearchPlaylist[];
  artists: SearchArtist[];
  albums: SearchAlbum[];
}

export interface SearchPlaylist {
  type: string;
  playlistId: string;
  name: string;
  artist: Artist;
  thumbnails: Thumbnail[];
}

export interface SearchArtist {
  type: string;
  artistId: string;
  name: string;
  thumbnails: Thumbnail[];
}

export interface SearchAlbum {
  type: string;
  albumId: string;
  playlistId: string;
  artist: Artist;
  year: number;
  name: string;
  thumbnails: Thumbnail[];
}
