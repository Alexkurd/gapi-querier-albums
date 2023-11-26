/**
 - Store all photos to list: OK
 - Delete all photos with albums from the list: OK
 - Create new album with current date: OK
 - Add all photos to the new album: Failed https://issuetracker.google.com/issues/132274769
 */

import apiGooglePhotos from '../helpers/google-photos.js';

const _mediaItemsIds = {};
const _existing_albums = {};

const _command_id = 'moveOrphanPhotosToAlbum'

//Add photos to the list
function storeMediaItems(mediaItems) {
    if (!mediaItems) {
        return;
    }

    for (const mi of mediaItems) {
        _mediaItemsIds[mi.id] = mi.id;
    }
}

//Remove photos from the list
function forgetMediaItems(mediaItems) {
    if (!mediaItems) {
        return;
    }

    for (const mi of mediaItems) {
        delete _mediaItemsIds[mi.id];
    }
}

//Add albums to the list
function storeAlbums(albums) {
    if (!_existing_albums) {
        return;
    }

    for (const al of albums) {
        _existing_albums[al.title] = al;
    }
}

async function requestPagedRecursively(method, path, body, processResults, pageToken) {
    let url = path;

    if (pageToken) {
        if (method === 'GET') {
            if (!path.endsWith('&') && !path.endsWith('?')) {
                url += (path.indexOf('?') >= 0) ? '&' : '?';
            }

            url += `pageToken=${pageToken}`;
        } else {
            body = body || {};
            body.pageToken = pageToken;
        }
    }

    return apiGooglePhotos.request(method, url, body)
        .then(async (results) => {
            throwOnResultsError(results);

            await processResults(results);

            if (results.nextPageToken) {
                return requestPagedRecursively(method, path, body, processResults, results.nextPageToken);
            }
        });
}

function throwOnResultsError(results) {
    if (results.error) {
        throw new Error(`${results.error.code} : ${results.error.status} : ${results.error.message}`);
    }
}

async function runAsync() {
    //Store all photos to mediaItems
    console.log('Get All Photos: start');
    await requestPagedRecursively('GET', '/mediaItems?pageSize=100', null, async (results) => {
        throwOnResultsError(results);
        storeMediaItems(results.mediaItems);
    });
    console.log('Get All Photos: end');
    console.log('Total photos:' + Object.keys(_mediaItemsIds).length);

    //Get all albums
    console.log('Get all albums: start')
    await requestPagedRecursively('GET', '/albums?pageSize=50', null, async (results) => {
        throwOnResultsError(results);
        if (!results.albums) return;

        //Save to exisiting albums
        storeAlbums(results.albums);

        for (const a of results.albums) {
            //Get all photos from each album and remove them from the mediaItems
            console.log('Getting photos from album ' + a.title);
            await requestPagedRecursively(
                'POST', '/mediaItems:search', {albumId: a.id, pageSize: 100},
                async (results) => forgetMediaItems(results.mediaItems));
        }
    });
    console.log('Get all albums: end');
    console.log('Total albums:' + Object.keys(_existing_albums).length);
    console.log(_existing_albums);

    console.log('Create new album: start');
    const newAlbum = await createAlbum();
    console.log(newAlbum);
    console.log('Create new album: end');

    let total_photos = Object.keys(_mediaItemsIds).length;

    if (total_photos) {
        console.log('Total photos not in albums: ' + total_photos);
        //Here you can add code to print photosIds
        //

        //Add photos to created album.
        const chunkSize = 50;
        for (let i = 0; i < total_photos; i += chunkSize) {
            const chunk = Object.keys(_mediaItemsIds).slice(i, i + chunkSize);
            await addToAlbum(chunk, newAlbum.id);
        }

        return 'New album <a href="' + newAlbum.productUrl + '" target="_blank">'
            + newAlbum.title +
            '</a> created';

    } else return 'No out-of-album photos found';
}

//Create new album or use existing with same name
async function createAlbum() {
    const date = new Intl.DateTimeFormat().format(new Date());
    const AlbumName = 'NotInAlbum ' + date;

    //Check existing albums
    if (_existing_albums[AlbumName] !== undefined) {
        console.log('Found existing. Use it.')
        return _existing_albums[AlbumName];
    }

    let method = 'POST';
    let url = '/albums';
    let body = {"album": {"title": AlbumName}};

    return apiGooglePhotos.request(method, url, body)
        .then(async (results) => {
            throwOnResultsError(results);
            return results;
        });
}

async function addToAlbum(ids, album_id) {
    let method = 'POST';
    let url = '/albums/' + album_id + ':batchAddMediaItems';
    let body = {"mediaItemIds": ids}

    return apiGooglePhotos.request(method, url, body)
        .then(async (results) => {
            throwOnResultsError(results);
            return results;
        });
}

export default [
    {
        name: 'Move out-of-album photos to new album(Shared Ignored)',
        scopes: 'https://www.googleapis.com/auth/photoslibrary',

        async run() {
            try {
                console.log(_command_id + ' : running');
                const output = await runAsync();
                console.log(_command_id + ' : finished');
                return output;
            } catch (err) {
                return err.toString();
            }
        }
    }
]