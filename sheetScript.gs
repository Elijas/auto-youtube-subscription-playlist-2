// TODO: Better exception handling for Youtube API calls
// TODO: Deal with playlist limits (~ 200-218 videos)
// TODO: Special keyword "ALLOTHER" for all other (unmentioned yet in the app) channel ids

function updatePlaylists() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var reservedTableRows = 3; // Start of the range of the PlaylistID+ChannelID data
  var reservedTableColumns = 2; // Start of the range of the ChannelID data
  var reservedTimestampCell = "F1";
  if (!sheet.getRange(reservedTimestampCell).getValue()) sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date()));
  
  var debugFlag_dontUpdateTimestamp = true;
  var debugFlag_dontUpdatePlaylists = false;
  
  /// For each playlist...
  for (var iRow = reservedTableRows; iRow < sheet.getLastRow(); iRow++) {
    var playlistId = data[iRow][0];
    if (!playlistId) continue;
    
    /// ...get channels...
    var channelIds = [];
    for (var iColumn = reservedTableColumns; iColumn < sheet.getLastColumn(); iColumn++) {
      var channel = data[iRow][iColumn];
      if (!channel) continue;
      else if (channel == "ALL")
        channelIds.push.apply(channelIds, getAllChannelIds());
      else if (!(channel.substring(0,2) == "UC" && channel.length > 10)) // Check if it is not a channel ID (therefore a username). MaybeTODO: do a better validation, since might interpret a channel with a name "UC..." as a channel ID
      {
        try {
          channelIds.push(YouTube.Channels.list('id', {forUsername: channel, maxResults: 1}).items[0].id);
        } catch (e) {
          Logger.log("ERROR: " + e.message);
          continue;
        }
      }
      else
        channelIds.push(channel);
    }
    
    /// ...get videos from the channels...
    var videoIds = [];
    var lastTimestamp = sheet.getRange(reservedTimestampCell).getValue();
    for (var i = 0; i < channelIds.length; i++) {
      videoIds.push.apply(videoIds, getVideoIds(channelIds[i], lastTimestamp)); // Append new videoIds array to the original one
    }
    
    if (!debugFlag_dontUpdateTimestamp) sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date())); // Update timestamp
    
    /// ...add videos to the playlist
    if (!debugFlag_dontUpdatePlaylists) {
      for (var i = 0; i < videoIds.length; i++) {
        try {
          YouTube.PlaylistItems.insert
          ( { snippet: 
             { playlistId: playlistId, 
              resourceId: 
              { videoId: videoIds[i],
               kind: 'youtube#video'
              }
             }
            }, 'snippet,contentDetails'
          );
        } catch (e) {
          Logger.log("ERROR: " + e.message);
          continue;
        }
        
        Utilities.sleep(1000);
      }
    }
  }
  sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date())) //to avoid adding the same videos twice, update the timestamp when script completes.
}

function getVideoIds(channelId, lastTimestamp) {
  var videoIds = [];
  
  // First call
  try {
    
    var results = YouTube.Search.list('id', {
      channelId: channelId,
      maxResults: 50,
      order: "date",
      publishedAfter: lastTimestamp
    });

  } catch (e) {
    Logger.log("ERROR: " + e.message);
    return;
  }

  for (var j = 0; j < results.items.length; j++) {
    var item = results.items[j];
    videoIds.push(item.id.videoId);
  }
  
  // Other calls
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
      Logger.log("ERROR: " + e.message);
      continue;
    }
    
    for (var j = 0; j < results.items.length; j++) {
      var item = results.items[j];
      videoIds.push(item.id.videoId);
    }
    
    nextPageToken = results.nextPageToken;
  }
  
  return videoIds;
}

function getAllChannelIds() { // get YT Subscriptions-List, src: https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/
  var AboResponse, AboList = [[],[]], nextPageToken = [], nptPage = 0, i, ix;

  // Workaround: nextPageToken API-Bug (this Tokens are limited to 1000 Subscriptions... but you can add more Tokens.)
  nextPageToken = ['','CDIQAA','CGQQAA','CJYBEAA','CMgBEAA','CPoBEAA','CKwCEAA','CN4CEAA','CJADEAA','CMIDEAA','CPQDEAA','CKYEEAA','CNgEEAA','CIoFEAA','CLwFEAA','CO4FEAA','CKAGEAA','CNIGEAA','CIQHEAA','CLYHEAA'];
  try {
    do {
      AboResponse = YouTube.Subscriptions.list('snippet', {
        mine: true,
        maxResults: 50,
        order: 'alphabetical',
        pageToken: nextPageToken[nptPage],
        fields: 'items(snippet(title,resourceId(channelId)))'
      });
      for (i = 0, ix = AboResponse.items.length; i < ix; i++) {
        AboList[0][AboList[0].length] = AboResponse.items[i].snippet.title;
        AboList[1][AboList[1].length] = AboResponse.items[i].snippet.resourceId.channelId;
      }
      nptPage += 1;
    } while (AboResponse.items.length > 0 && nptPage < 20);
    if (AboList[0].length !== AboList[1].length) {
      return 'Length Title != ChannelId'; // returns a string === error
    }
  } catch (e) {
    return e;
  }
  
  Logger.log('Acquired subscriptions %s', AboList[1].length);
  return AboList[1];
}

function getAllChannelIds_OLD() { // Note: this function is not used.
  var channelIds = [];
  
  // First call
  try {
    var results = YouTube.Subscriptions.list('snippet', {
      mine: true,
      maxResults: 50
    });
  } catch (e) {
    Logger.log("ERROR: " + e.message);
    return;
  }
  for (var i = 0; i < results.items.length; i++) {
    var item = results.items[i];
    channelIds.push(item.snippet.resourceId.channelId);
  }  
  
  // Other calls
  var nextPageToken = results.nextPageToken;
  for (var pageNo = 0; pageNo < (-1+Math.ceil(results.pageInfo.totalResults / 50.0)); pageNo++) {
    
    try {
      results = YouTube.Subscriptions.list('snippet', {
        mine: true,
        maxResults: 50,
        pageToken: nextPageToken
      });
    } catch (e) {
      Logger.log("ERROR: " + e.message);
      continue;
    }
    for (var i = 0; i < results.items.length; i++) {
      var item = results.items[i];
      channelIds.push(item.snippet.resourceId.channelId);
    }
    
    nextPageToken = results.nextPageToken;
  }
  
  Logger.log('Acquired subscriptions %s, Actual subscriptions %s', channelIds.length, results.pageInfo.totalResults);
  return channelIds;
}

function ISODateString(d) { // modified from src: http://stackoverflow.com/questions/7244246/generate-an-rfc-3339-timestamp-similar-to-google-tasks-api
 function pad(n){return n<10 ? '0'+n : n}
 return d.getUTCFullYear()+'-'
      + pad(d.getUTCMonth()+1)+'-'
      + pad(d.getUTCDate())+'T'
      + pad(d.getUTCHours())+':'
      + pad(d.getUTCMinutes())+':'
      + pad(d.getUTCSeconds())+'.000Z'
}

function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu("Functions", [{name: "Update Playlists", functionName: "updatePlaylists"}]);
}
