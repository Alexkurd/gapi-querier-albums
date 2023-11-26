//import example from './commands/example.js';
import findOutOfAlbumPhotos from './commands/findOutOfAlbumPhotos.js';
import moveOrphanPhotosToAlbum from './commands/moveOrphanPhotosToAlbum.js';


export default [

	findOutOfAlbumPhotos,
	moveOrphanPhotosToAlbum

].flat(); // Individual commands imports may return arrays of commands, flatten them here.