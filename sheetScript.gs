// TODO: Exception handling for Youtube API calls
// TODO: Special keyword "ALLOTHER" for all other (unmentioned yet in the app) channel ids
// TODO: Limiting (batching?) videoId upload to a playlist
// TODO: Deal with playlist limits (~ 200-218 videos)

function updatePlaylists() {
  // Sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var reservedTableRows = 3; // Start of the range of the PlaylistID+ChannelID data
  var reservedTableColumns = 2; // Start of the range of the ChannelID data
  var reservedTimestampCell = "F1";
  if (!sheet.getRange(reservedTimestampCell).getValue()) sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date()));
  var userChannelId = sheet.getRange("C1").getValue(); //TODO: Validate if cell is not empty
  
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
        channelIds.push.apply(channelIds, getAllChannelIds(userChannelId));
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
    
    sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date())); // Update timestamp
    
    /// ...add videos to the playlist
    for (var i = 0; i < videoIds.length; i++) {
      /**/
      try {
        YouTube.PlaylistItems.insert
        ( { snippet: 
           { playlistId: 'PL1YG9ktx9sVdPMMt3ewQ6RQWhO-K1CskE', 
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
      /**/
      
      Utilities.sleep(1000);
    }
  }
  
}

function getVideoIds(channelId, lastTimestamp) {
  var videoIds = [];
  
  // First call
  try {
    
    var results = YouTube.Search.list('id', {
      channelId: channelId,
      maxResults: 2,
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
        maxResults: 2,
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

function getAllChannelIds(userChannelId) { // TODO: Does it really return ALL channels? (a couple seemed to be missing during the tests)
  var channelIds = [];
  
  // First call
  try {
    var results = YouTube.Subscriptions.list('snippet', {
      channelId: userChannelId,
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
        channelId: userChannelId,
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

