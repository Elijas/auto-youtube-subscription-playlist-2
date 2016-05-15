// The core functionality of the program, used for debugging
// Instructions:
// 1. Create an empty Docs or Sheet File
// 2. Open Script Editor and copy-paste the contents
// 3. Change values in main() function
// 4. Select 'main' and run it, authorize (`Resources`/`Advanced Google Services`)
// 5. See the log (Ctrl+Enter in the Script Editor) for details

function err(id,msg) {
  out("ERROR in "+id+": "+msg);
}
function out(s) {
  Logger.log(s);
}

////////////////////////

function main() {
  var lastTimestamp = "2016-04-30T13:22:53.000Z"
  var playlistId = "PLN-2p7teOQQwXuihgy5E3lAywmd_pHjo"; // *** CHANGE THIS ***
  var channelId = "UCbiGcwDWZjz05njNPrJU7jA"; //a.k.a. "ExplainingComputers"

  addNewVideosToPlaylist(channelId, lastTimestamp, playlistId)
}

////////////////////////

function addNewVideosToPlaylist(channelId, lastTimestamp, playlistId) {
  // First request
  try {
    var results = YouTube.Search.list('id', {
      channelId: channelId,
      maxResults: 50,
      order: "date",
      publishedAfter: lastTimestamp
    });
  } catch (e) {
    err(1,e.message);
    throw new Error(e);
  }
  
  addVideosToPlaylist(results, playlistId);

  // Subsequent requests
  var nextPageToken = results.nextPageToken;
  for (var pageNo = 0; pageNo < (-1+Math.ceil(results.pageInfo.totalResults / 50.0)); pageNo++) {
    try {
      results = YouTube.Search.list('id', {
        channelId: channelId,
        maxResults: 50,
        order: "date",
        publishedAfter: lastTimestamp,
        pageToken: nextPageToken
      });
    } catch (e) {
      err(2,e.message);
      throw new Error(e);
    }
    
    addVideosToPlaylist(results, playlistId);
    
    nextPageToken = results.nextPageToken;
  }
}

function addVideosToPlaylist(results, playlistId) {
  Logger.log(results);
  for (var j = 0; j < results.items.length; j++) {
    var videoId = results.items[j].id.videoId;
    if (videoId == undefined) continue;
    Logger.log(videoId);
    
    try {
      YouTube.PlaylistItems.insert( { 
        snippet: { 
          playlistId: playlistId, 
          resourceId: {
            videoId: videoId,
            kind: 'youtube#video'
          }
         }
        },
        'snippet'//,contentDetails'
      );
    } catch (e) {
      err('adding video '+videoId+' to '+playlistId,e.message);
      throw new Error(e);
    }
  }
}
