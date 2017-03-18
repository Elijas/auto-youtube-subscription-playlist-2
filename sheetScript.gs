function doGet(e) {
    // url = https://docs.google.com/spreadsheets/d/XXXXXXXXXX/edit#gid=0
    var sheetID = 'XXXXXXXXXX';  // Paste the Sheet ID here, it's the long string in the Sheet URL

    if (e.parameter.update == "True") {
        var sheet = SpreadsheetApp.openById(sheetID).getSheets()[0];
        updatePlaylists(sheet);
    };

    var t = HtmlService.createTemplateFromFile('index.html');
    t.data = e.parameter.pl;
    t.sheetID = sheetID;
    return t.evaluate();
}

function updatePlaylists(sheet) {
  if (sheet.toString() != 'Sheet') sheet = SpreadsheetApp.openById('XXXXXXXXXX').getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var reservedTableRows = 3; // Start of the range of the PlaylistID+ChannelID data
  var reservedTableColumns = 2; // Start of the range of the ChannelID data
  var reservedTimestampCell = "F1";
  //if (!sheet.getRange(reservedTimestampCell).getValue()) sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date()));
  if (!sheet.getRange(reservedTimestampCell).getValue()) {
    var date = new Date();
    date.setHours(date.getHours() - 24); // Subscriptions added starting with the last day
    var isodate = date.toISOString();
    sheet.getRange(reservedTimestampCell).setValue(isodate);
  }

  var debugFlag_dontUpdateTimestamp = false;
  var debugFlag_dontUpdatePlaylists = false;




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
      else if (channel == "ALL")
        channelIds.push.apply(channelIds, getAllChannelIds());
      else if (channel.substring(0,2) == "PL" && channel.length > 10)  // Add videos from playlist. MaybeTODO: better validation, since might interpret a channel with a name "PL..." as a playlist ID
         playlistIds.push(channel);
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
    for (var i = 0; i < playlistIds.length; i++) {
      videoIds.push.apply(videoIds, getPlaylistVideoIds(playlistIds[i], lastTimestamp));
    }

    //causes only first line to be updated
    //if (!debugFlag_dontUpdateTimestamp) sheet.getRange(reservedTimestampCell).setValue(ISODateString(new Date())); // Update timestamp

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
  if (!debugFlag_dontUpdateTimestamp) {
    var date = new Date();
    sheet.getRange(reservedTimestampCell).setValue(ISODateString(date)); // Update timestamp
  }
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
        pageToken: nextPageToken});
    } catch (e) {
      Logger.log("ERROR: " + e.message);
      nextPageToken = null;
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
  SpreadsheetApp.getActiveSpreadsheet().addMenu("Functions", [{name: "Update Playlists", functionName: "insideUpdate"}, {name: "Update Month", functionName: "checkMonthlyPlaylist"}]);
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
//Check for if the monthly playlist has been made yet
//if so, nothing happens, if not, creat it and replace it in the spreadsheet!
function checkMonthlyPlaylist() {
  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth();
  var title = getMonthText(month) + " " + String(year) + " Watch Later";
  var tempTitle;
  var found = false;
  var request = YouTube.Playlists.list('snippet', {'mine':true, 'maxResults': 5});

  for(var i = 0; i < request.items.length; i++) {
    tempTitle = request.items[i].snippet.title;
    if(tempTitle === title) {
      found = true;
      break;
    }
  }
  if(!found) {
    createPlaylist(title, title);
  }
}

function getMonthText(month) {
  switch(month) {
    case 0:
      return "Jan"
      break;
    case 1:
      return "Feb"
      break;
    case 2:
      return "Mar"
      break;
    case 3:
      return "Apr"
      break;
    case 4:
      return "May"
      break;
    case 5:
      return "Jun"
      break;
    case 6:
      return "Jul"
      break;
    case 7:
      return "Aug"
      break;
    case 8:
      return "Sep"
      break;
    case 9:
      return "Oct"
      break;
    case 10:
      return "Nov"
      break;
    case 11:
      return "Dec"
      break;
  }
}

function createPlaylist(title, description) {


  var request = YouTube.Playlists.insert(
    {
      snippet: {
        title: title,
        description: description
      },
      status: {
        privacyStatus: 'private'
      }
    }, 'snippet, status');
  var sheetID = 'XXXXXXXXXX';  // Paste the Sheet ID here, it's the long string in the Sheet URL
  var sheet = SpreadsheetApp.openById(sheetID).getSheets()[0];
  //A4 is first playlist. Hardcoded in.
  var cell = sheet.getRange('A4');
  var test = request.id;
  cell.setValue(test);
}
