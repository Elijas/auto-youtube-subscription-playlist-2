// MAYBE TODO: Better exception handling for Youtube API calls
// MAYBE TODO: Deal with playlist limits (~ 200-218 videos)
// MAYBE TODO: Special keyword "ALLOTHER" for all other (unmentioned yet in the app) channel ids
// MAYBE TODO: Filtering based on text (regexp?) in title and description
// MAYBE TODO: NOT flags to include videos that are NOT from certain channels / do not contain text, etc

var errorflag = false;
var debugFlag_dontUpdateTimestamp = false;
var debugFlag_dontUpdatePlaylists = false;
var debugFlag_logWhenNoNewVideosFound = false;

function doGet(e) {
    var sheetID = PropertiesService.getScriptProperties().getProperty("sheetID");
    if (e.parameter.update == "True") {
        var sheet = SpreadsheetApp.openById(sheetID).getSheets()[0];
        updatePlaylists(sheet);
    };

    var t = HtmlService.createTemplateFromFile('index.html');
    t.data = e.parameter.pl
    t.sheetID = sheetID
    return t.evaluate();
}

function updatePlaylists(sheet) {
  const sheetID = PropertiesService.getScriptProperties().getProperty("sheetID")
  if (!sheetID) onOpen()
  const spreadsheet = SpreadsheetApp.openById(sheetID)
  if (!sheet || !sheet.toString || sheet.toString() != 'Sheet') sheet = spreadsheet.getSheets()[0];
  const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
  const data = sheet.getDataRange().getValues();
  const reservedTableRows = 3; // Start of the range of the PlaylistID+ChannelID data
  const reservedTableColumns = 2; // Start of the range of the ChannelID data
  const reservedDeleteDaysColumn = 1; // Column containing number of days before today until videos get deleted
  const reservedTimestampCell = "F1";
  //if (!sheet.getRange(reservedTimestampCell).getValue()) sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date()));
  if (!sheet.getRange(reservedTimestampCell).getValue()) {
    var date = new Date();
    date.setHours(date.getHours() - 24); // Subscriptions added starting with the last day
    var isodate = date.toISOString();
    sheet.getRange(reservedTimestampCell).setValue(isodate);
  }

  /// For each playlist...
  for (var iRow = reservedTableRows; iRow < sheet.getLastRow(); iRow++) {
    var playlistId = data[iRow][0];
    if (!playlistId) continue;

    /// ...get channels...
    var channelIds = [];
    var playlistIds = [];
    for (var iColumn = reservedTableColumns; iColumn < sheet.getLastColumn(); iColumn++) {
      var channel = data[iRow][iColumn];
      if (!channel) continue;
      else if (channel == "ALL") {
        var newChannelIds = getAllChannelIds();
        if (!newChannelIds || newChannelIds.length === 0) Logger.log("Could not find any subscriptions")
        else [].push.apply(channelIds, newChannelIds);
      } else if (channel.substring(0,2) == "PL" && channel.length > 10)  // Add videos from playlist. MaybeTODO: better validation, since might interpret a channel with a name "PL..." as a playlist ID
         playlistIds.push(channel);
      else if (!(channel.substring(0,2) == "UC" && channel.length > 10)) // Check if it is not a channel ID (therefore a username). MaybeTODO: do a better validation, since might interpret a channel with a name "UC..." as a channel ID
      {
        try {
          var channel = YouTube.Channels.list('id', {forUsername: channel, maxResults: 1});
          if (!channel || !channel.items) Logger.log("Cannot query for channel")
          else if (channel.items.length === 0) Logger.log("No channel with this name")
          else if (channel.items.length !== 1) Logger.log("Multiple channels with this name")
          else if (!channel.items[0].id) Logger.log("Cannot get id from this channel")
          else channelIds.push(channel.items[0].id);
        } catch (e) {
          Logger.log("Cannot search for channels, ERROR: " + e.message);
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
      var newVideoIds = getVideoIds(channelIds[i], lastTimestamp)
      if (!newVideoIds || typeof(newVideoIds) !== "object") Logger.log("Failed to get videos with channel id "+channelIds[i])
      else [].push.apply(videoIds, newVideoIds); // Append new videoIds array to the original one
    }
    for (var i = 0; i < playlistIds.length; i++) {
      var newVideoIds = getVideoIds(playlistIds[i], lastTimestamp)
      if (!newVideoIds || typeof(newVideoIds) !== "object") Logger.log("Failed to get videos with playlist id "+playlistIds[i])
      else [].push.apply(videoIds, newVideoIds);
    }
    
    Logger.log("Acquired "+videoIds.length+" videos ")
    
    //causes only first line to be updated
    //if (!debugFlag_dontUpdateTimestamp) sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date())); // Update timestamp

    /// ...add videos to the playlist
    var errorCount = 0;
    if (!debugFlag_dontUpdatePlaylists && videoIds.length < 200) {
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
          Logger.log("Couldn't update playlist with video ("+videoIds[i]+"), ERROR: " + e.message);
          errorCount += 1;
          var errorflag = true;
          continue;
        }

        Utilities.sleep(1000);
      }
      Logger.log("Added "+(i -= errorCount)+" videos to playlist. Error for "+errorCount+" videos.")
    } else {
      Logger.log("More than 200 videos are to be added, script cannot add this many.")
      var errorflag = true;
    }
    
    
    /// ...delete old vidoes in playlist
    var daysBack = data[iRow][reservedDeleteDaysColumn];
    if (!daysBack || !(daysBack > 0) ) continue;
    
    var deleteBeforeTimestamp = ISODateString(new Date((new Date()).getTime() - daysBack*MILLIS_PER_DAY));
    Logger.log("Delete before: "+deleteBeforeTimestamp);
    deletePlaylistItems(playlistId, deleteBeforeTimestamp);
    
  }
  
  // Prints logs to Debug sheet
  var debugSheet = spreadsheet.getSheetByName("Debug")
  if (!debugSheet) debugSheet = spreadsheet.insertSheet("Debug")
  var newLogs = Logger.getLog().split("\n").slice(0, -1).map(function(log) {return log.split(" INFO: ")})
  if (newLogs.length > 0) debugSheet.clear().getRange(1, 1, newLogs.length, 2).setValues(newLogs)

  if (errorflag) throw new Error("One or more videos was not added to playlist correctly, please check Debug sheet. Timestamp has not been updated.")
  if (!debugFlag_dontUpdateTimestamp) sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date())); // Update timestamp
}

function getVideoIds(channelId, lastTimestamp) {
  var videoIds = [];
  
  try {
    // Check Channel validity
    var results = YouTube.Channels.list('id', {
      id: channelId
    });
    if (!results || !results.items) {
      Logger.log("YouTube channel search returned invalid response for channel with id "+channelId)
      return []
    } else if (results.items.length === 0) {
      Logger.log("Cannot find channel with id "+channelId)
      return []
    }
  } catch (e) {
    Logger.log("Cannot lookup channel on YouTube, ERROR: " + e.message);
    return [];
  }


  // First call
  try {

    var results = YouTube.Search.list('id', {
      channelId: channelId,
      maxResults: 50,
      order: "date",
      publishedAfter: lastTimestamp
    });
    if (!results || !results.items) {
      Logger.log("YouTube video search returned invalid response for channel with id "+channelId)
      return []
    } else if (results.items.length === 0) {
      if (debugFlag_logWhenNoNewVideosFound) {
        Logger.log("Channel with id "+channelId+" has no new videos")
      }
      return []
    }
  } catch (e) {
    Logger.log("Cannot search YouTube, ERROR: " + e.message);
    return [];
  }

  for (var j = 0; j < results.items.length; j++) {
    var item = results.items[j];
    if (!item.id) {
      Logger.log("YouTube search result ("+item+") doesn't have id")
      continue
    } else if (!item.id.videoId) {
      Logger.log("YouTube search result ("+item+") doesn't have videoId")
      continue
    }
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
      if (!results || !results.items) {
        Logger.log("YouTube video search returned invalid response for channel with id "+channelId)
        return []
      } else if (results.items.length === 0) {
        if (debugFlag_logWhenNoNewVideosFound) {
          Logger.log("Channel with id "+channelId+" has no new videos")
        }
        break
      }
    } catch (e) {
      Logger.log("Cannot search YouTube, ERROR: " + e.message);
      return [];
    }

    for (var j = 0; j < results.items.length; j++) {
      var item = results.items[j];
      if (!item.id) {
        Logger.log("YouTube search result ("+item+") doesn't have id")
        continue
      } else if (!item.id.videoId) {
        Logger.log("YouTube search result ("+item+") doesn't have videoId")
        continue
      }
      videoIds.push(item.id.videoId);
    }

    nextPageToken = results.nextPageToken;
  }

  return videoIds;
}

function getPlaylistVideoIds(playlistId, lastTimestamp) {
  var videoIds = [];
  
  // Check Playlist validity
  var results = YouTube.Playlists.list('id', {
    id: playlistId
  });
  if (!results || !results.items) {
    Logger.log("YouTube channel search returned invalid response for playlist with id "+playlistId)
    return []
  } else if (results.items.length === 0) {
    Logger.log("Cannot find playlist with id "+playlistId)
    return []
  }

  var nextPageToken = '';
  while (nextPageToken != null){

    try {
      var results = YouTube.PlaylistItems.list('snippet', {
        playlistId: playlistId,
        maxResults: 50,
        order: "date",
        publishedAfter: lastTimestamp,
        pageToken: nextPageToken
      });
      if (!results || !results.items) {
        Logger.log("YouTube playlist search returned invalid response for playlist with id "+playlistId)
        break
      } else if (results.items.length === 0) {
        if (debugFlag_logWhenNoNewViwdeosFound) {
          Logger.log("Playlist with id "+playlistIdw+" has no new videos")
        }
        break
      }
    } catch (e) {
      Logger.log("Cannot search YouTube, ERROR: " + e.message);
      nextPageToken = null;
      break
    }

    for (var j = 0; j < results.items.length; j++) {
      var item = results.items[j];
      if (item.snippet.publishedAt > lastTimestamp)
        videoIds.push(item.snippet.resourceId.videoId);
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
        AboList[0].push(AboResponse.items[i].snippet.title)
        AboList[1].push(AboResponse.items[i].snippet.resourceId.channelId)
      }
      nptPage += 1;
    } while (AboResponse.items.length > 0 && nptPage < 20);
    if (AboList[0].length !== AboList[1].length) {
      Logger.log('Length of Titles != Length of ChannelIds'); // returns a string === error
      return []
    }
  } catch (e) {
    Logger.log("Could not get subscription channels, ERROR: " + e.message);
    return [];
  }

  Logger.log('Acquired subscriptions %s', AboList[1].length);
  return AboList[1];
}

function deletePlaylistItems(playlistId, deleteBeforeTimestamp) {
  var nextPageToken = '';
  while (nextPageToken != null){

    try {
      var results = YouTube.PlaylistItems.list('contentDetails', {
        playlistId: playlistId,
        maxResults: 50,
        order: "date",
        publishedBefore: deleteBeforeTimestamp, // this compares the timestamp when the video was added to playlist
        pageToken: nextPageToken});
        
      for (var j = 0; j < results.items.length; j++) {
        var item = results.items[j];
        if (item.contentDetails.videoPublishedAt < deleteBeforeTimestamp) // this compares the timestamp when the video was published
        { 
          Logger.log("Del: | "+item.contentDetails.videoPublishedAt)
          YouTube.PlaylistItems.remove(item.id)
        }
      }
      
      nextPageToken = results.nextPageToken;

    } catch (e) {
      Logger.log("ERROR: " + e.message);
      nextPageToken = null;
    }
  }
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
  SpreadsheetApp.getActiveSpreadsheet().addMenu("Functions", [{name: "Update Playlists", functionName: "insideUpdate"}]);
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheets()[0]
  if (!sheet || sheet.getRange("A3").getValue() !== "Playlist ID") throw new Error("Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)")
  PropertiesService.getScriptProperties().setProperty("sheetID", ss.getId())
}

function insideUpdate(){
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  updatePlaylists(sheet);
}

function playlist(pl, sheetID){
  var sheet = SpreadsheetApp.openById(sheetID).getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var reservedTableRows = 3; // Start of the range of the PlaylistID+ChannelID data
  if (pl == undefined){
    pl = reservedTableRows;
  } else {
    pl = Number(pl) + reservedTableRows - 1;  // I like to think of the first playlist as being number 1.
  }

  if (pl > sheet.getLastRow()){
    pl = sheet.getLastRow();
  }

  var playlistId = data[pl][0];
  return playlistId
}
