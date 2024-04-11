// Auto Youtube Subscription Playlist (2)
// This is a Google Apps Script that automatically adds new Youtube videos to playlists (a replacement for Youtube Collections feature).
// Code: https://github.com/Elijas/auto-youtube-subscription-playlist-2/
// Copy Spreadsheet: 
// https://docs.google.com/spreadsheets/d/1sZ9U52iuws6ijWPQTmQkXvaZSV3dZ3W9JzhnhNTX9GU/copy

// Adjustable to quota of Youtube API
const maxVideos = 200;

// Errorflags
var errorflag = false;
var quotaExceeded = false;
const quotaExceededReason = "quotaExceeded";
var plErrorCount = 0;
var totalErrorCount = 0;
const debugFlag_dontUpdateTimestamp = false;
const debugFlag_dontUpdatePlaylists = false;
const debugFlag_logWhenNoNewVideosFound = false;

// Reserved Row and Column indices (zero-based)
// If you use getRange remember those indices are one-based, so add + 1 in that call i.e.
// sheet.getRange(iRow + 1, reservedColumnTimestamp + 1).setValue(isodate);
const reservedTableRows = 3;          // Start of the range of the PlaylistID+ChannelID data
const reservedTableColumns = 6;       // Start of the range of the ChannelID data (0: A, 1: B, 2: C, 3: D, 4: E, 5: F, ...)
const reservedColumnPlaylist = 0;     // Column containing playlist to add to
const reservedColumnTimestamp = 1;    // Column containing last timestamp
const reservedColumnFrequency = 2;    // Column containing number of hours until new check
const reservedColumnDeleteDays = 3;   // Column containing number of days before today until videos get deleted
const reservedColumnShortsFilter = 4; // Column containing switch for using shorts filter
// Reserved lengths
const reservedDebugNumRows = 900;   // Number of rows to use in a column before moving on to the next column in debug sheet
const reservedDebugNumColumns = 26; // Number of columns to use in debug sheet, must be at least 4 to allow infinite cycle

// Extend Date with Iso String with timzone support (Youtube needs IsoDates)
// https://stackoverflow.com/questions/17415579/how-to-iso-8601-format-a-date-with-timezone-offset-in-javascript
Date.prototype.toIsoString = function () {
  var tzo = -this.getTimezoneOffset(),
    dif = tzo >= 0 ? '+' : '-',
    pad = function (num) {
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
    additional = sheet ? ", instead found sheet with name " + sheet.getName() : ""
    throw new Error("Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)" + additional)
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
    Logger.log("Row: " + (iRow + 1));
    var playlistId = data[iRow][reservedColumnPlaylist];
    if (!playlistId || playlistId.substring(0, 1) == "#")
      continue;

    if (quotaExceeded) {
      addError("Quota exceeded, skipping row!")
      continue;
    }

    var lastTimestamp = data[iRow][reservedColumnTimestamp];
    if (!lastTimestamp) {
      var date = new Date();
      date.setHours(date.getHours() - 24); // Subscriptions added starting with the last day
      var isodate = date.toIsoString();
      sheet.getRange(iRow + 1, reservedColumnTimestamp + 1).setValue(isodate);
      lastTimestamp = isodate;
    }

    // Check if it's time to update already
    var lastDate = new Date(lastTimestamp);
    var lastTime = lastDate.getTime();
    var dateDiff = Date.now() - lastTime;
    var nextTimeDiff = data[iRow][reservedColumnFrequency] * MILLIS_PER_HOUR;
    if (nextTimeDiff && dateDiff <= nextTimeDiff) {
      Logger.log("Skipped: Not time yet");
    } else {
      /// ...get channels...
      var channelIds = [];
      var playlistIds = [];
      for (var iColumn = reservedTableColumns; iColumn < sheet.getLastColumn(); iColumn++) {
        var channel = data[iRow][iColumn];
        if (!channel)
          continue;
        else if (channel == "ALL") {
          var newChannelIds = getAllChannelIds();
          if (!newChannelIds || newChannelIds.length === 0)
            addError("Could not find any subscriptions");
          else
            [].push.apply(channelIds, newChannelIds);
        } else if (channel.substring(0, 2) == "PL" && channel.length > 10)  // Add videos from playlist. MaybeTODO: better validation, since might interpret a channel with a name "PL..." as a playlist ID
          playlistIds.push(channel);
        else if (!(channel.substring(0, 2) == "UC" && channel.length > 10)) // Check if it is not a channel ID (therefore a username). MaybeTODO: do a better validation, since might interpret a channel with a name "UC..." as a channel ID
        {
          try {
            var user = YouTube.Channels.list('id', { forUsername: channel, maxResults: 1 });
            if (!user || !user.items) addError("Cannot query for user " + channel)
            else if (user.items.length === 0) addError("No user with name " + channel)
            else if (user.items.length !== 1) addError("Multiple users with name " + channel)
            else if (!user.items[0].id) addError("Cannot get id from user " + channel)
            else channelIds.push(user.items[0].id);
          } catch (e) {
            if (e.details && e.details.errors.some(error => error.reason == quotaExceededReason)) {
              quotaExceeded = true;
            }
            addError("Cannot search for channel with name " + channel + ", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
            continue;
          }
        }
        else
          channelIds.push(channel);
      }

      /// ...get videos from the channels...
      var newVideos = [];
      for (var i = 0; i < channelIds.length; i++) {
        var videos = getChannelVideos(channelIds[i], lastDate);
        if (!videos || typeof (videos) !== "object") {
          addError("Failed to get videos with channel id " + channelIds[i])
        } else if (debugFlag_logWhenNoNewVideosFound && videos.length === 0) {
          Logger.log("Channel with id " + channelIds[i] + " has no new videos")
        } else {
          [].push.apply(newVideos, videos);
        }
      }
      for (var i = 0; i < playlistIds.length; i++) {
        var videos = getPlaylistVideos(playlistIds[i], lastDate)
        if (!videos || typeof (videos) !== "object") {
          addError("Failed to get videos with playlist id " + playlistIds[i])
        } else if (debugFlag_logWhenNoNewVideosFound && videos.length === 0) {
          Logger.log("Playlist with id " + playlistIds[i] + " has no new videos")
        } else {
          [].push.apply(newVideos, videos);
        }
      }

      Logger.log("Acquired " + newVideos.length + " videos")

      newVideos = applyFilters(newVideos, sheet, iRow);

      Logger.log("Filtering finished, left with " + newVideos.length + " videos")

      if (!errorflag) {
        var newTimestamp = null;

        // ...add videos to playlist...
        if (!debugFlag_dontUpdatePlaylists) {
          newTimestamp = addVideosToPlaylist(playlistId, newVideos);
        } else {
          addError("Don't Update Playlists debug flag is set");
        }

        // ...delete old vidoes in playlist
        var daysBack = data[iRow][reservedColumnDeleteDays];
        if (daysBack && (daysBack > 0)) {
          var deleteBeforeTimestamp = new Date((new Date()).getTime() - daysBack * MILLIS_PER_DAY).toIsoString();
          Logger.log("Delete before: " + deleteBeforeTimestamp);
          deletePlaylistItems(playlistId, deleteBeforeTimestamp);
        }

        // Default to no timestamp change in case of errors
        if (!newTimestamp)
          newTimestamp = lastTimestamp;
        // Update timestamp
        if (!debugFlag_dontUpdateTimestamp) {
          sheet.getRange(iRow + 1, reservedColumnTimestamp + 1).setValue(newTimestamp);
          Logger.log("Updating last update timestamp from " + lastTimestamp + " to " + newTimestamp);
        } else
          addError("Don't Update Timestamp debug flag is set. Not updating timestamp to: " + newTimestamp);
      }
    }
    // Prints logs to Debug sheet
    var newLogs = Logger.getLog().split("\n").slice(0, -1).map(function (log) {
      if (log.search("limit") != -1 && log.search("quota") != -1)
        errorflag = true;
      return log.split(" INFO: ");
    })
    if (newLogs.length > 0)
      debugSheet.getRange(nextDebugRow + 1, nextDebugCol + 1, newLogs.length, 2).setValues(newLogs)
    nextDebugRow += newLogs.length;
    errorflag = false;
    totalErrorCount += plErrorCount;
    plErrorCount = 0;
  }

  // Log finished script, only populate second column to signify end of execution when retrieving logs
  if (totalErrorCount == 0) {
    debugSheet.getRange(nextDebugRow + 1, nextDebugCol + 2).setValue("Updated all rows, script successfully finished")
  } else {
    debugSheet.getRange(nextDebugRow + 1, nextDebugCol + 2).setValue("Script did not successfully finish")
  }
  nextDebugRow += 1;
  // Clear next debug column if filled reservedDebugNumRows rows
  if (nextDebugRow > reservedDebugNumRows - 1) {
    var colIndex = 0;
    if (nextDebugCol < reservedDebugNumColumns - 2) {
      colIndex = nextDebugCol + 2;
    }
    clearDebugCol(debugSheet, colIndex)
  }
  loadLastDebugLog(debugViewerSheet);
  if (totalErrorCount > 0) {
    throw new Error(totalErrorCount + " errors were encountered while adding videos to playlists. Please check Debug sheet. Timestamps for respective rows have not been updated.")
  }
}

//
// Functions to obtain channel IDs to check
//

// Display dialog to get channel ID from channel name
function getChannelId() {
  var ui = SpreadsheetApp.getUi();

  var result = ui.prompt(
    'Get Channel ID',
    'Please input a channel name:',
    ui.ButtonSet.OK_CANCEL);
  var button = result.getSelectedButton();
  var text = result.getResponseText();

  if (button == ui.Button.OK) {
    var results = YouTube.Search.list('id', {
      q: text,
      type: "channel",
      maxResults: 50,
    });

    for (var i = 0; i < results.items.length; i++) {
      var result = ui.alert(
        'Please confirm',
        'Is this the link to the channel you want?\n\nhttps://youtube.com/channel/' + results.items[i].id.channelId + '',
        ui.ButtonSet.YES_NO);
      if (result == ui.Button.YES) {
        ui.alert('The channel ID is ' + results.items[i].id.channelId);
        return;
      } else if (result == ui.Button.NO) {
        continue;
      } else {
        return;
      }
    }

    ui.alert('No results found for ' + text + '.');
  } else if (button == ui.Button.CANCEL) {
    return;
  } else if (button == ui.Button.CLOSE) {
    return;
  }
}

// Get Channel IDs from Subscriptions (ALL keyword)
function getAllChannelIds() {
  if (quotaExceeded) {
    addError("Skipping getting all channel IDs due to exceeded quota!")
    return [];
  }

  // get YT Subscriptions-List, src: https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/
  var AboResponse, AboList = [[], []], nextPageToken = [], nptPage = 0, i, ix;
  // Workaround: nextPageToken API-Bug (this Tokens are limited to 1000 Subscriptions... but you can add more Tokens.)
  nextPageToken = ['', 'CDIQAA', 'CGQQAA', 'CJYBEAA', 'CMgBEAA', 'CPoBEAA', 'CKwCEAA', 'CN4CEAA', 'CJADEAA', 'CMIDEAA', 'CPQDEAA', 'CKYEEAA', 'CNgEEAA', 'CIoFEAA', 'CLwFEAA', 'CO4FEAA', 'CKAGEAA', 'CNIGEAA', 'CIQHEAA', 'CLYHEAA'];
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
      addError("While getting subscriptions, the number of titles (" + AboList[0].length + ") did not match the number of channels (" + AboList[1].length + ")."); // returns a string === error
      return []
    }
  } catch (e) {
    if (e.details && e.details.errors.some(error => error.reason == quotaExceededReason)) {
      quotaExceeded = true;
    }
    addError("Could not get subscribed channels, ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
    return [];
  }

  Logger.log('Acquired subscriptions %s', AboList[1].length);
  return AboList[1];
}

//
// Functions to get Videos
//

// Get video metadata from Channels but with less Quota use
// slower and date ordering is a bit messy but less quota costs
function getChannelVideos(channelId, startDate) {
  if (quotaExceeded) {
    addError("Skipping getting all channel ID " + channelId + " uploads due to exceeded quota!")
    return [];
  }

  var uploadsPlaylistId;
  try {
    // Check Channel validity
    var results = YouTube.Channels.list('contentDetails', {
      id: channelId
    });
    if (!results) {
      addError("YouTube channel search returned invalid response for channel with id " + channelId)
      return []
    } else if (!results.items || results.items.length === 0) {
      addError("Cannot find channel with id " + channelId)
      return []
    } else {
      uploadsPlaylistId = results.items[0].contentDetails.relatedPlaylists.uploads;
    }
  } catch (e) {
    if (e.details && e.details.errors.some(error => error.reason == quotaExceededReason)) {
      quotaExceeded = true;
    }
    addError("Cannot search YouTube for channel with id " + channelId + ", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
    return [];
  }

  return getPlaylistVideos(uploadsPlaylistId, startDate);
}

// Get Video metadata from Playlist
function getPlaylistVideos(playlistId, startDate) {
  if (quotaExceeded) {
    addError("Skipping getting all videos in playlist ID " + playlistId + " due to exceeded quota!")
    return [];
  }

  var videos = [];
  var nextPageToken = '';
  while (nextPageToken != null) {
    try {
      var results = YouTube.PlaylistItems.list('contentDetails', {
        playlistId: playlistId,
        maxResults: 50,
        publishedAfter: startDate.toIsoString(), // According to documentation this isn't supported with YouTube.PlaylistItems.list but it seems to help...
        pageToken: nextPageToken
      });
      if (!results || !results.items) {
        addError("YouTube playlist search returned invalid response for playlist with id " + playlistId)
        return [];
      }
    } catch (e) {
      if (e.details) {
        if (e.details.code === 404) {
          Logger.log("Warning: Channel " + channelId + " does not have any uploads in " + uploadsPlaylistId + ", ignore if this is intentional as this will not fail the script. API error details for troubleshooting: " + JSON.stringify(e.details));
        }
        if (e.details.errors.some(error => error.reason == quotaExceededReason)) {
          Logger.log("Cannot search YouTube with playlist id " + playlistId + ", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
          quotaExceeded = true;
          return [];
        }
        Logger.log("Cannot search YouTube with playlist id " + playlistId + ", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      } else {
        Logger.log("Cannot search YouTube with playlist id " + playlistId + ", ERROR: " + "Message: [" + e.message + "]");
      }
      break;
    }

    // Filter out videos published before the last time this ran
    [].push.apply(videos, results.items.map(video => video.contentDetails).filter(video => startDate <= new Date(video.videoPublishedAt)));
    nextPageToken = results.nextPageToken;
  }

  if (videos.length === 0) {
    try {
      // Check Playlist validity
      var results = YouTube.Playlists.list('id', {
        id: playlistId
      });
      if (!results || !results.items) {
        addError("YouTube search returned invalid response for playlist with id " + playlistId)
        return []
      } else if (results.items.length === 0) {
        addError("Cannot find playlist with id " + playlistId)
        return []
      }
    } catch (e) {
      if (e.details && e.details.errors.some(error => error.reason == quotaExceededReason)) {
        quotaExceeded = true;
      }
      addError("Cannot lookup playlist with id " + playlistId + " on YouTube, ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      return [];
    }
  }

  return videos;
}

// Sort videos by oldest first
function sortVideos(vid1, vid2) {
  var date1 = new Date(vid1.videoPublishedAt);
  var date2 = new Date(vid2.videoPublishedAt);
  if (date1 < date2)
    return -1;
  if (date1 > date2)
    return 1;
  return 0;
}

//
// Functions to Add and Delete videos to playlist
//

// Add Videos to Playlist using Video IDs and upload times
function addVideosToPlaylist(playlistId, videos) {
  var successCount = 0;
  var errorCount = 0;
  var lastSuccessTimestamp = null;
  var totalVideos = videos.length;
  videos.sort(sortVideos); // Sort videos in order to automatically handle exceeded quota
  if (0 < totalVideos && totalVideos < maxVideos) {
    for (var i = 0; i < totalVideos; i++) {
      // Use a buffer of 1 second to retry this video next time on quota exceeded failure
      lastSuccessTimestamp = new Date(new Date(videos[i].videoPublishedAt).getTime() - 5000).toIsoString();
      try {
        YouTube.PlaylistItems.insert({
          snippet: {
            playlistId: playlistId,
            resourceId: {
              videoId: videos[i].videoId,
              kind: 'youtube#video'
            }
          }
        }, 'snippet');
        successCount++;
      } catch (e) {
        if (e.details && e.details.errors.some(error => error.reason == quotaExceededReason)) {
          // Increase error count by remaining vids (including this one)
          errorCount += totalVideos - i;
          quotaExceeded = true;
          addError("Quota exceeded while adding videos! Updating last update timestamp to pick up where this run left off: " + lastSuccessTimestamp);
          break;
        } else if (e.details.code === 409) { // Skip error count if Video exists in playlist already
          Logger.log("Couldn't update playlist with video (" + videos[i] + "), ERROR: Video already exists")
        } else if (e.details.code === 400 && e.details.errors[0].reason === "playlistOperationUnsupported") {
          addError("Couldn't update watch later or watch history playlist with video, functionality deprecated; try adding videos to a different playlist")
          errorCount++;
        } else {
          try {
            var results = YouTube.Videos.list('snippet', {
              id: videos[i].videoId
            });
            if (results.items.length === 0) { // Skip error count if video is private (found when using getPlaylistVideoIds)
              Logger.log("Couldn't update playlist with video (" + videos[i] + "), ERROR: Cannot find video, most likely private")
            } else {
              addError("Couldn't update playlist with video (" + videos[i] + "), ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
              errorCount++;
            }
          } catch (e) {
            if (e.details && e.details.errors.some(error => error.reason == quotaExceededReason)) {
              // Increase error count by remaining vids (including this one)
              errorCount += totalVideos - i;
              quotaExceeded = true;
              addError("Quota exceeded while adding videos! Updating last update timestamp to pick up where this run left off: " + lastSuccessTimestamp);
              break;
            } else {
              addError("Couldn't update playlist with video (" + videos[i] + "), 404 on update, tried to search for video with id, got ERROR: Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
              errorCount++;
            }
          }
        }
      }
    }
    Logger.log("Added " + successCount + " video(s) to playlist. Error for " + errorCount + " video(s).")
    errorflag = (errorCount > 0);
  } else if (totalVideos == 0) {
    Logger.log("No new videos yet.")
  } else {
    addError("The query contains " + totalVideos + " videos. Script cannot add more than " + maxVideos + " videos. Try moving the timestamp closer to today.")
  }

  return lastSuccessTimestamp;
}

// Delete Videos from Playlist if they're older than the defined time or dupes
function deletePlaylistItems(playlistId, deleteBeforeTimestamp) {
  var nextPageToken = '';
  var oldIds = [];
  var videoIdMap = new Map();
  while (nextPageToken != null) {
    try {
      var results = YouTube.PlaylistItems.list('contentDetails', {
        playlistId: playlistId,
        maxResults: 50,
        order: "date",
        pageToken: nextPageToken
      });

      results.items.forEach(video => {
        if (video.contentDetails.videoPublishedAt < deleteBeforeTimestamp) { // this compares the timestamp when the video was published
          Logger.log("Del: | " + video.contentDetails)
          oldIds.push(video.id);
        } else {
          if (!videoIdMap.has(video.contentDetails.videoId))
            videoIdMap.set(video.contentDetails.videoId, [video.id])
          else
            videoIdMap.get(video.contentDetails.videoId).push(video.id);
        }
      });

      nextPageToken = results.nextPageToken;
    } catch (e) {
      addError("Problem getting existing videos from playlist with id " + playlistId + ", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
      break;
    }
  }

  // Delete old videos
  try {
    oldIds.forEach(id => YouTube.PlaylistItems.remove(id));
  } catch (e) {
    addError("Problem deleting old videos from playlist with id " + playlistId + ", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
  }

  // Delete duplicates by PlaylistItem id
  try {
    var duplicateIds = [];
    videoIdMap.forEach((ids, key, map) => [].push.apply(duplicateIds, ids.slice(1)));
    duplicateIds.forEach(id => YouTube.PlaylistItems.remove(id));
  } catch (e) {
    addError("Problem deleting duplicate videos from playlist with id " + playlistId + ", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
  }
}

//
// Functions for filtering videos
//

// Returns a new filtered array of videos based on the filters selected in the sheet
function applyFilters(videos, sheet, iRow) {
  if (quotaExceeded) {
    addError("Skipping filtering videos due to exceeded quota!")
    return [];
  }

  let filters = []
  // Removes all shorts if enabled
  if (sheet.getRange(iRow + 1, reservedColumnShortsFilter + 1).getValue() == "No") {
    Logger.log("Removing shorts");
    filters.push(removeShortsFilter);
  }
  return videos.filter(video => filters.reduce((acc, cur) => acc && cur(video.videoId), true));
}

// Returns false if video is a short by checking if its length is less than a minute
// There might be better/more accurate ways
function removeShortsFilter(videoId) {
  try {
    let response = YouTube.Videos.list('contentDetails', {
      id: videoId,
    });
    if (response.items && response.items.length) {
      let duration = response.items[0].contentDetails.duration;
      return !isLessThanAMinute(duration)
    }
  } catch (e) {
    if (e.details && e.details.errors.some(error => error.reason == quotaExceededReason)) {
      quotaExceeded = true;
    }
    addError("Problem filtering shorts for video with id " + videoId + ", ERROR: " + "Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
  }
  return false;
}

// Checks if an ISO 8601 duration is less or equal than a minute.
// Verifying the duration is of the form PT1M or PTXXX.XXXS where X represents digits.
function isLessThanAMinute(duration) {
  // Check if duration is 1 minute
  // Since there can be a 1 second variation, we check for 1 minute + 1 second too, due to following bug
  // https://stackoverflow.com/questions/72459082/yt-api-pulling-different-video-lengths-for-youtube-videos
  if (duration == "PT1M" || duration == "PT1M1S") return true;
  if (duration.slice(0, 2) != "PT") return false;
  for (let i = 2; i < duration.length - 1; i++) {
    // Check if is digit
    if (duration[i] > '9') return false;
  }
  return duration[duration.length - 1] == 'S';
}

//
// Functions for maintaining debug logs
//

// Parse debug sheet to find column of cell to write debug logs to
function getNextDebugCol(debugSheet) {
  var data = debugSheet.getDataRange().getValues();
  // Only one column, not filled yet, return this column
  if (data.length < reservedDebugNumRows) return 0;
  // Need to iterate since next col might be in middle of data
  for (var col = 0; col < reservedDebugNumColumns; col += 2) {
    // New column
    // Necessary check since data is list of lists and col might be out of bounds
    if (data[0].length < col + 1) return col
    // Unfilled column
    if (data[reservedDebugNumRows - 1][col + 1] == "") return col;
  }
  clearDebugCol(debugSheet, 0)
  return 0;
}

// Parse debug sheet to find row of cell to write debug logs to
function getNextDebugRow(debugSheet, nextDebugCol) {
  var data = debugSheet.getDataRange().getValues();
  // Empty sheet, return first row
  if (data.length == 1 && data[0].length == 1 && data[0][0] == "") return 0;
  // Only one column, not filled yet, return last row + 1
  // Second check needed in case reservedDebugNumRows has expanded while other columns are filled
  if (data.length < reservedDebugNumRows && data[0][0] != "") return data.length;
  for (var row = 0; row < reservedDebugNumRows; row++) {
    // Found empty row
    if (data[row][nextDebugCol + 1] == "") return row;
  }
  return 0;
}

// Clear column in debug sheet for next execution's logs
function clearDebugCol(debugSheet, colIndex) {
  // Clear first reservedDebugNumRows rows
  debugSheet.getRange(1, colIndex + 1, reservedDebugNumRows, 2).clear();
  // Clear as many additional rows as necessary
  var rowIndex = reservedDebugNumRows;
  while (debugSheet.getRange(rowIndex + 1, colIndex + 1, 1, 2).getValues()[0][1] != "") {
    debugSheet.getRange(rowIndex + 1, colIndex + 1, 1, 2).clear();
    rowIndex += 1;
  }
}

// Add execution entry to debug viewer, shift previous executions and remove earliest if too many
function initDebugEntry(debugViewer, nextDebugCol, nextDebugRow) {
  // Clear currently viewing logs to get proper last row
  debugViewer.getRange("B3").clear();
  // Calculate number of existing executions
  var numExecutionsRecorded = debugViewer.getDataRange().getLastRow() - 2;
  var maxToCopy = debugViewer.getRange("B1").getValue() - 1
  var numToCopy = numExecutionsRecorded
  if (numToCopy > maxToCopy) {
    numToCopy = maxToCopy
  }
  // Shift existing executions
  debugViewer.getRange(4, 1, numToCopy, 1).setValues(debugViewer.getRange(3, 1, numToCopy, 1).getValues())
  if (numExecutionsRecorded - numToCopy > 0) {
    debugViewer.getRange(4 + numToCopy, 1, numExecutionsRecorded - numToCopy, 1).clear()
  }
  // Copy new execution
  debugViewer.getRange(3, 1).setValue("=DebugData!" + debugViewer.getRange(nextDebugRow + 1, nextDebugCol + 1).getA1Notation())
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
          results.push([data[row][col + 1]]);
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
  SpreadsheetApp.getActiveSpreadsheet().addMenu("Youtube Controls", [
    { name: "Update Playlists", functionName: "updatePlaylists" },
    { name: "Get Channel ID", functionName: "getChannelId" }
  ]);
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheets()[0]
  if (!sheet || sheet.getRange("A3").getValue() !== "Playlist ID") {
    additional = sheet ? ", instead found sheet with name " + sheet.getName() : ""
    throw new Error("Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)" + additional)
  }
  PropertiesService.getScriptProperties().setProperty("sheetID", ss.getId())
}

// Function to publish Script as Web App
function doGet(e) {
  var sheetID = PropertiesService.getScriptProperties().getProperty("sheetID");
  if (e.parameter.update == "True") {
    var sheet = SpreadsheetApp.openById(sheetID).getSheets()[0];
    if (!sheet || sheet.getRange("A3").getValue() !== "Playlist ID") {
      additional = sheet ? ", instead found sheet with name " + sheet.getName() : ""
      throw new Error("Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)" + additional)
    }
    updatePlaylists(sheet);
  };

  var t = HtmlService.createTemplateFromFile('index.html');
  t.data = e.parameter.pl
  t.sheetID = sheetID
  return t.evaluate();
}

// Function to select playlist for Web App
function playlist(pl, sheetID) {
  var sheet = SpreadsheetApp.openById(sheetID).getSheets()[0];
  var data = sheet.getDataRange().getValues();
  if (pl == undefined) {
    pl = reservedTableRows;
  } else {
    pl = Number(pl) + reservedTableRows - 1;  // I like to think of the first playlist as being number 1.
  }
  if (pl > sheet.getLastRow()) {
    pl = sheet.getLastRow();
  }
  var playlistId = data[pl][reservedColumnPlaylist];
  return playlistId
}

function test1() {
  Logger.log("hi")
  // let duration = "";
  // Logger.log(duration[duration.length - 1]);
  // let videoId = "FAyKDaXEAgc";
  // let response = YouTube.Videos.list('contentDetails', {
  //   id: videoId,
  // });
  // if (response.items && response.items.length) {
  //   let duration = response.items[0].contentDetails.duration;
  //   if (isLessThanAMinute(duration)) {
  //     Logger.log("Is a short");
  //   } else {
  //     Logger.log("Is not a short");
  //   }
  // }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  let videoIds = ["FAyKDaXEAgc", "_y_QLeVOpqs", "7KEA5_8rd0A", "LTiI6tvU48c"];
  Logger.log(applyFilters(videoIds, sheet));
}
