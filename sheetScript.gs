// Auto Youtube Subscription Playlist (2)
// This is a Google Apps Script that automatically adds new Youtube videos to playlists (a replacement for Youtube Collections feature).
// Code: https://github.com/Elijas/auto-youtube-subscription-playlist-2/
// Copy Spreadsheet: 
// https://docs.google.com/spreadsheets/d/1sZ9U52iuws6ijWPQTmQkXvaZSV3dZ3W9JzhnhNTX9GU/copy

// Adjustable to quota of Youtube API
var maxVideos = 200;

// Errorflags
var errorflag = false;
var plErrorCount = 0;
var totalErrorCount = 0;
var debugFlag_dontUpdateTimestamp = false;
var debugFlag_dontUpdatePlaylists = false;
var debugFlag_logWhenNoNewVideosFound = false;


// Define reserved Rows and Columns (zero-based)
var reservedTableRows = 3;        // Start of the range of the PlaylistID+ChannelID data
var reservedTableColumns = 5;     // Start of the range of the ChannelID data (0: A, 1: B, 2: C, 3: D, 4: E, 5: F, ...)
var reservedColumnPlaylist = 0;   // Column containing playlist to add to
var reservedColumnTimestamp = 1;  // Column containing last timestamp
var reservedColumnFrequency = 2;  // Column containing number of hours until new check
var reservedColumnDeleteDays = 3; // Column containing number of days before today until videos get deleted
var reservedDebugWrapRow = 900;   // Last row to fill before moving on to the next column in debug sheet
var reservedDebugNumColumns = 26; // Number of columns to use in debug sheet
// If you use getRange remember those indices are one-based, so add + 1 in that call i.e.
// sheet.getRange(iRow + 1, reservedColumnTimestamp + 1).setValue(isodate);

// Extend Date with Iso String with timzone support (Youtube needs IsoDates)
// https://stackoverflow.com/questions/17415579/how-to-iso-8601-format-a-date-with-timezone-offset-in-javascript
Date.prototype.toIsoString = function() {
    var tzo = -this.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function(num) {
            var norm = Math.floor(Math.abs(num));
            return (norm < 10 ? '0' : '') + norm;
        };
    return this.getFullYear() +
        '-' + pad(this.getMonth() + 1) +
        '-' + pad(this.getDate()) +
        'T' + pad(this.getHours()) +
        ':' + pad(this.getMinutes()) +
        ':' + pad(this.getSeconds()) +
        dif + pad(tzo / 60) +
        ':' + pad(tzo % 60);
}

//
// Main Function to update all Playlists
//

function updatePlaylists(sheet) {
  var sheetID = PropertiesService.getScriptProperties().getProperty("sheetID")
  if (!sheetID) onOpen()
  var spreadsheet = SpreadsheetApp.openById(sheetID)
  if (!sheet || !sheet.toString || sheet.toString() != 'Sheet') sheet = spreadsheet.getSheets()[0];
  if (!sheet || sheet.getRange("A3").getValue() !== "Playlist ID") {
    additional = sheet ? ", instead found sheet with name "+ sheet.getName() : ""
    throw new Error("Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)"+ additional)
  }
  var MILLIS_PER_HOUR = 1000 * 60 * 60;
  var MILLIS_PER_DAY = MILLIS_PER_HOUR * 24;
  var data = sheet.getDataRange().getValues();
  var debugSheet = spreadsheet.getSheetByName("DebugData")
  if (!debugSheet) debugSheet = spreadsheet.insertSheet("DebugData").hideSheet()
  var nextDebugCol = getNextDebugCol(debugSheet);
  var nextDebugRow = getNextDebugRow(debugSheet, nextDebugCol);
  var debugViewerSheet = spreadsheet.getSheetByName("Debug");
  initDebugEntry(debugViewerSheet, nextDebugCol, nextDebugRow);

  /// For each playlist...
  for (var iRow = reservedTableRows; iRow < sheet.getLastRow(); iRow++) {
    Logger.clear();
    Logger.log("Row: " + (iRow+1));
    var playlistId = data[iRow][reservedColumnPlaylist];
    if (!playlistId) continue;

    var lastTimestamp = data[iRow][reservedColumnTimestamp];
    if (!lastTimestamp) {
      var date = new Date();
      date.setHours(date.getHours() - 24); // Subscriptions added starting with the last day
      var isodate = date.toIsoString();
      sheet.getRange(iRow + 1, reservedColumnTimestamp + 1).setValue(isodate);
      lastTimestamp = isodate;
    }
  
    // Check if it's time to update already
    var freqDate = new Date(lastTimestamp);
    var dateDiff = Date.now() - freqDate;
    var nextTime = data[iRow][reservedColumnFrequency]  * MILLIS_PER_HOUR;
    if (nextTime && dateDiff <= nextTime) {
      Logger.log("Skipped: Not time yet");
    } else {
      /// ...get channels...
      var channelIds = [];
      var playlistIds = [];
      for (var iColumn = reservedTableColumns; iColumn < sheet.getLastColumn(); iColumn++) {
        var channel = data[iRow][iColumn];
        if (!channel) continue;
        else if (channel == "ALL") {
          var newChannelIds = getAllChannelIds();
          if (!newChannelIds || newChannelIds.length === 0) addError("Could not find any subscriptions");
          else [].push.apply(channelIds, newChannelIds);
        } else if (channel.substring(0,2) == "PL" && channel.length > 10)  // Add videos from playlist. MaybeTODO: better validation, since might interpret a channel with a name "PL..." as a playlist ID
           playlistIds.push(channel);
        else if (!(channel.substring(0,2) == "UC" && channel.length > 10)) // Check if it is not a channel ID (therefore a username). MaybeTODO: do a better validation, since might interpret a channel with a name "UC..." as a channel ID
        {
          try {
            var user = YouTube.Channels.list('id', {forUsername: channel, maxResults: 1});
            if (!user || !user.items) addError("Cannot query for user " + channel)
            else if (user.items.length === 0) addError("No user with name " + channel)
            else if (user.items.length !== 1) addError("Multiple users with name " + channel)
            else if (!user.items[0].id) addError("Cannot get id from user " + channel)
            else channelIds.push(user.items[0].id);
          } catch (e) {
            addError("Cannot search for channel with name "+channel+", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
            continue;
          }
        }
        else
          channelIds.push(channel);
      }
      
      /// ...get videos from the channels...
      var newVideoIds = [];
      for (var i = 0; i < channelIds.length; i++) {
        var videoIds = getVideoIdsWithLessQueries(channelIds[i], lastTimestamp)
        if (!videoIds || typeof(videoIds) !== "object") addError("Failed to get videos with channel id "+channelIds[i])
        else if (debugFlag_logWhenNoNewVideosFound && videoIds.length === 0) {
          Logger.log("Channel with id "+channelIds[i]+" has no new videos")
        } else {
          [].push.apply(newVideoIds, videoIds);
        }
      }
      for (var i = 0; i < playlistIds.length; i++) {
        var videoIds = getPlaylistVideoIds(playlistIds[i], lastTimestamp)
        if (!videoIds || typeof(videoIds) !== "object") addError("Failed to get videos with playlist id "+playlistIds[i])
        else if (debugFlag_logWhenNoNewVideosFound && videoIds.length === 0) {
          Logger.log("Playlist with id "+playlistIds[i]+" has no new videos")
        } else {
          [].push.apply(newVideoIds, videoIds);
        }
      }
        
      Logger.log("Acquired "+newVideoIds.length+" videos")
      
      if (!errorflag) {
        // ...add videos to playlist...
        if (!debugFlag_dontUpdatePlaylists) {
          addVideosToPlaylist(playlistId, newVideoIds);
        } else {
          addError("Don't Update Playlists debug flag is set");
        }
        
        /// ...delete old vidoes in playlist
        var daysBack = data[iRow][reservedColumnDeleteDays];
        if (daysBack && (daysBack > 0)) {
          var deleteBeforeTimestamp = new Date((new Date()).getTime() - daysBack*MILLIS_PER_DAY).toIsoString();
          Logger.log("Delete before: "+deleteBeforeTimestamp);
          deletePlaylistItems(playlistId, deleteBeforeTimestamp);
        }
      }
    // Update timestamp
    if (!errorflag && !debugFlag_dontUpdateTimestamp) sheet.getRange(iRow + 1, reservedColumnTimestamp + 1).setValue(new Date().toIsoString()); 
    }
    // Prints logs to Debug sheet
    var newLogs = Logger.getLog().split("\n").slice(0, -1).map(function(log) {if(log.search("limit") != -1 && log.search("quota") != -1)errorflag=true;return log.split(" INFO: ")})
    if (newLogs.length > 0) debugSheet.getRange(nextDebugRow, nextDebugCol, newLogs.length, 2).setValues(newLogs)
    nextDebugRow += newLogs.length;
    errorflag = false;
    totalErrorCount += plErrorCount;
    plErrorCount = 0;
  }
  
  if (totalErrorCount == 0) {
    debugSheet.getRange(nextDebugRow, nextDebugCol+1).setValue("Updated all rows, script successfully finished")
  }
  // Clear next debug column if filled reservedDebugWrapRow rows
  if (nextDebugRow >= reservedDebugWrapRow) {
    var colIndex = 1;
    if (nextDebugCol < reservedDebugNumColumns-1) {
      colIndex = nextDebugCol+2;
    }
    // Clear first reservedDebugWrapRow rows
    debugSheet.getRange(1, colIndex, reservedDebugWrapRow, 2).clear();
    // Clear as many additional rows as necessary
    var rowIndex = reservedDebugWrapRow+1;
    while (debugSheet.getRange(rowIndex, colIndex, 1, 2).getValues()[0][1] != "") {
      debugSheet.getRange(rowIndex, colIndex, 1, 2).clear();
      rowIndex += 1;
    }
  }
  loadLastDebugLog(debugViewerSheet);
  if (totalErrorCount > 0) {
    throw new Error(totalErrorCount+" video(s) were not added to playlists correctly, please check Debug sheet. Timestamps for respective rows has not been updated.")
  }
}

//
// Functions to obtain channel IDs to check
//

// Get Channel IDs from Subscriptions (ALL keyword)
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
      addError("While getting subscriptions, the number of titles ("+AboList[0].length+") did not match the number of channels ("+AboList[1].length+")."); // returns a string === error
      return []
    }
  } catch (e) {
    addError("Could not get subscribed channels, ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
    return [];
  }

  Logger.log('Acquired subscriptions %s', AboList[1].length);
  return AboList[1];
}

//
// Functions to get Videos
//

// Get new videos from Channels
function getVideoIds(channelId, lastTimestamp) {
  var videoIds = [];
  var nextPageToken = '';
  do {
    try {
      var results = YouTube.Search.list('id', {
        channelId: channelId,
        maxResults: 50,
        order: "date",
        publishedAfter: lastTimestamp,
        pageToken: nextPageToken,
        type: "video"
      });
      if (!results || !results.items) {
        addError("YouTube video search returned invalid response for channel with id "+channelId)
        return []
      }
    } catch (e) {
      Logger.log("Cannot search YouTube with channel id "+channelId+", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      break;
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
  } while (nextPageToken != null);

  if (videoIds.length === 0) {
    try {
      // Check Channel validity
      var results = YouTube.Channels.list('id', {
        id: channelId
      });
      if (!results || !results.items) {
        addError("YouTube channel search returned invalid response for channel with id "+channelId)
        return []
      } else if (results.items.length === 0) {
        addError("Cannot find channel with id "+channelId)
        return []
      }
    } catch (e) {
      addError("Cannot search YouTube for channel with id "+channelId+", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      return [];
    }
  }

  return videoIds;
}

// Get videos from Channels but with less Quota use
// slower and date ordering is a bit messy but less quota costs
function getVideoIdsWithLessQueries(channelId, lastTimestamp) {
  var videoIds = [];
  var uploadsPlaylistId;
  try {
    // Check Channel validity
    var results = YouTube.Channels.list('contentDetails', {
      id: channelId
    });
    if (!results || !results.items) {
      addError("YouTube channel search returned invalid response for channel with id "+channelId)
      return []
    } else if (results.items.length === 0) {
      addError("Cannot find channel with id "+channelId)
      return []
    } else {
      uploadsPlaylistId = results.items[0].contentDetails.relatedPlaylists.uploads;
    }
  } catch (e) {
    addError("Cannot search YouTube for channel with id "+channelId+", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
    return [];
  }

  nextPageToken = ''
  do {
    try {
      var results = YouTube.PlaylistItems.list('contentDetails', {
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: nextPageToken
      })
      var videosToBeAdded = results.items.filter(function (vid) {return ((new Date(lastTimestamp)) <= (new Date(vid.contentDetails.videoPublishedAt)))})
      if (videosToBeAdded.length == 0) {
        break;
      } else {
        [].push.apply(videoIds, videosToBeAdded.map(function (vid) {return vid.contentDetails.videoId}));
      }
      nextPageToken = results.nextPageToken;
    } catch (e) {
      if (e.details.code !== 404) { // Skip error count if Playlist isn't found, then channel is empty
        addError("Cannot search YouTube with playlist id "+uploadsPlaylistId+", ERROR: Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      } else {
        Logger.log("Channel "+channelId+" does not have any uploads in "+uploadsPlaylistId+", Failed with error Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      }
      return [];
    }
  } while (nextPageToken != null);
  
  return videoIds.reverse(); // Reverse to get videos in ascending order by date
}

// Get Video IDs from Playlist
function getPlaylistVideoIds(playlistId, lastTimestamp) {
  var videoIds = [];
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
        addError("YouTube playlist search returned invalid response for playlist with id "+playlistId)
        return [];
      }
    } catch (e) {
      Logger.log("Cannot search YouTube with playlist id "+playlistId+", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      break
    }

    for (var j = 0; j < results.items.length; j++) {
      var item = results.items[j];
      if (item.snippet.publishedAt > lastTimestamp)
        videoIds.push(item.snippet.resourceId.videoId);
    }

    nextPageToken = results.nextPageToken;
  }

  if (videoIds.length === 0) {
    try {
      // Check Playlist validity
      var results = YouTube.Playlists.list('id', {
        id: playlistId
      });
      if (!results || !results.items) {
        addError("YouTube channel search returned invalid response for playlist with id "+playlistId)
        return []
      } else if (results.items.length === 0) {
        addError("Cannot find playlist with id "+playlistId)
        return []
      }
    } catch (e) {
      addError("Cannot lookup playlist with id "+playlistId+" on YouTube, ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      return [];
    }
  }

  return videoIds;
}

//
// Functions to Add and Delete videos to playlist
//

// Add Videos to Playlist using Video IDs obtained before
function addVideosToPlaylist(playlistId, videoIds, idx = 0, successCount = 0, errorCount = 0) {
  var totalVids = videoIds.length;
  if (0 < totalVids && totalVids < maxVideos) {
    try {
      YouTube.PlaylistItems.insert({
        snippet: {
          playlistId: playlistId,
          resourceId: {
            videoId: videoIds[idx],
            kind: 'youtube#video'
          }
      }
      }, 'snippet');
      var success = 1;
    } catch (e) {
      if (e.details.code === 404) { // Skip error count if video is private (found when using getPlaylistVideoIds)
        try {
          var results = YouTube.Videos.list('snippet', {
            id: videoIds[idx]
          });
          if (results.items.length === 0) {
            Logger.log("Couldn't update playlist with video ("+videoIds[idx]+"), ERROR: Cannot find video, most likely private")
            errorCount -= 1;
          } else {
            addError("Couldn't update playlist with video ("+videoIds[idx]+"), 404 on update, but found video with API, not sure what to do");
          }
        } catch (e) {
          addError("Couldn't update playlist with video ("+videoIds[idx]+"), 404 on update, tried to search for video with id, got ERROR: Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
        }
      } else if (e.details.code === 400 && e.details.errors[0].reason === "playlistOperationUnsupported") {
        addError("Couldn't update watch later or watch history playlist with video, functionality deprecated; try adding videos to a different playlist")
      } else if (e.details.code === 409) { // Skip error count if Video exists in playlist already
        Logger.log("Couldn't update playlist with video ("+videoIds[idx]+"), ERROR: Video already exists")
      } else {
        addError("Couldn't update playlist with video ("+videoIds[idx]+"), ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      }
      errorCount += 1;
      success = 0;
    } finally {
      idx += 1;
      successCount += success;
      if (totalVids == idx) {
        Logger.log("Added "+successCount+" video(s) to playlist. Error for "+errorCount+" video(s).")
        errorflag = (errorCount > 0);
      } else {
        addVideosToPlaylist(playlistId, videoIds, idx, successCount, errorCount);
      }
    }
  } else if (totalVids == 0) {	
    Logger.log("No new videos yet.")	
  } else {	
    addError("The query contains "+totalVids+" videos. Script cannot add more than "+maxVideos+" videos. Try moving the timestamp closer to today.")	
  }
}

// Delete Videos from Playlist if they're older than the defined time
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
      addError("Problem deleting existing videos from playlist with id "+playlistId+", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      nextPageToken = null;
    }
  }
}

//
// Functions for maintaining debug logs
//

// Parse debug sheet to find column of cell to write debug logs to
function getNextDebugCol(debugSheet) {
  var data = debugSheet.getDataRange().getValues();
  // Only one column, not filled yet, return this column
  if (data.length < reservedDebugWrapRow) return 1;
  for (var col = 0; col < reservedDebugNumColumns; col += 2) {
    // New column
    if (data[0].length < col+1) return col+1;
    // Unfilled column
    if (data[reservedDebugWrapRow-1][col+1] == "") return col+1;
  }
  throw Error("No empty spots")
}

// Parse debug sheet to find row of cell to write debug logs to
function getNextDebugRow(debugSheet, nextDebugCol) {
  var data = debugSheet.getDataRange().getValues();
  // Empty sheet, return first row
  if (data.length == 1 && data[0] == "") return 1;
  // Only one column, not filled yet, return last row
  if (data.length < reservedDebugWrapRow) return data.length+1;
  // New column, return first row
  if (data[0].length < nextDebugCol) return 1;
  for (var row = reservedDebugWrapRow-1; row >= 0; row--) {
    if (data[row][nextDebugCol] != "") return row+1+1;
  }
  return 1;
}

// Add execution entry to debug viewer, maybe shift rows if enough executions already
function initDebugEntry(debugViewer, nextDebugCol, nextDebugRow) {
  // Clear currently viewing logs to get proper last row
  debugViewer.getRange("B2").clear();
  // Calculate number of existing executions
  var lastRow = debugViewer.getDataRange().getLastRow()+1;
  var maxSaved = debugViewer.getRange("B1").getValue()
  var toCopy = maxSaved - 1
  if (lastRow - 2 < maxSaved - 1) {
    toCopy = lastRow - 2
  }
  // Copy existing executions up to maximum
  debugViewer.getRange(4, 1, toCopy, 1).setValues(debugViewer.getRange(3, 1, toCopy, 1).getValues())
  if (lastRow - 2 - (toCopy + 1) > 0) {
    debugViewer.getRange(4+toCopy, 1, lastRow - 2 - (toCopy + 1), 1).clear()
  }
  // Copy new execution
  debugViewer.getRange(3, 1).setValue("=DebugData!"+debugViewer.getRange(nextDebugRow, nextDebugCol).getA1Notation())
}

// Set currently viewed execution logs to most recent execution
function loadLastDebugLog(debugViewer) {
  debugViewer.getRange("B3").setValue(debugViewer.getRange("A3").getValue());
}

// Given an execution's (first log's) timestamp, return an array with the execution's logs
// Returns "" or Error if can't find logs
function getLogs(timestamp) {
  if (timestamp == "") return "";
  var debugSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DebugData");
  if (!debugSheet) throw Error("No debug logs");
  var data = debugSheet.getDataRange().getValues();
  var results = []
  for (var col = 0; col < data[0].length; col += 2) {
    for (var row = 0; row < data.length; row++) {
      if (data[row][col] == timestamp) {
        for (; row < data.length; row++) {
          if (data[row][col] == "") break;
          results.push([data[row][col+1]]);
        }
        return results;
      }
    }
  }
  return ""
}

//
// Functions for Housekeeping
// Makes Web App, function call from Google Sheets, add errors, etc
//

// Log errors in debug sheet and throw an error
function addError(s) {
  Logger.log(s);
  errorflag = true;
  plErrorCount += 1;
}

// Function to Set Up Google Spreadsheet
function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu("Youtube Controls", [{name: "Update Playlists", functionName: "updatePlaylists"}]);
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheets()[0]
  if (!sheet || sheet.getRange("A3").getValue() !== "Playlist ID") {
    additional = sheet ? ", instead found sheet with name "+ sheet.getName() : ""
    throw new Error("Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)"+ additional)
  }
  PropertiesService.getScriptProperties().setProperty("sheetID", ss.getId())
}

// Function to publish Script as Web App
function doGet(e) {
    var sheetID = PropertiesService.getScriptProperties().getProperty("sheetID");
    if (e.parameter.update == "True") {
        var sheet = SpreadsheetApp.openById(sheetID).getSheets()[0];
        if (!sheet || sheet.getRange("A3").getValue() !== "Playlist ID") {
          additional = sheet ? ", instead found sheet with name "+ sheet.getName() : ""
          throw new Error("Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)"+ additional)
        }
        updatePlaylists(sheet);
    };

    var t = HtmlService.createTemplateFromFile('index.html');
    t.data = e.parameter.pl
    t.sheetID = sheetID
    return t.evaluate();
}

// Function to select playlist for Web App
function playlist(pl, sheetID){
  var sheet = SpreadsheetApp.openById(sheetID).getSheets()[0];
  var data = sheet.getDataRange().getValues();
  if (pl == undefined){
    pl = reservedTableRows;
  } else {
    pl = Number(pl) + reservedTableRows - 1;  // I like to think of the first playlist as being number 1.
  }
  if (pl > sheet.getLastRow()){
    pl = sheet.getLastRow();
  }
  var playlistId = data[pl][reservedColumnPlaylist];
  return playlistId
}
