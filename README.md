# Description
This is a Google Apps Script that automatically adds new Youtube videos to playlists (a replacement for Youtube Collections feature). 

This is done using Google Sheets for interface, Google Script + Youtube API v3 for executing and scheduling.

[(Older version here)](https://github.com/Elijas/auto-youtube-subscription-playlist-2)

# Features
1. Adds all new videos to Youtube playlists (uploaded later than some date)
  
  1.1. From ALL subscribed channels
  
  1.2. From any list of channels (by username or channel ID)
  
2. Optional - ability to set automatic interval for updates

# Set-up Instructions
1. [Copy](https://docs.google.com/spreadsheets/d/1sZ9U52iuws6ijWPQTmQkXvaZSV3dZ3W9JzhnhNTX9GU/copy) the Sheet to your Google Drive.
2. Allow the Sheets to access Youtube:
  - Open the `Script Editor` (in menu: `Tools` / `Script Editor...`) of the Sheet
  - In menu: `Resources` / `Advanced Google Services` / `Google Developers Console` / `Youtube Data API` / `Enable API`
  - Close the Developers Console and Script Editor, open the Sheet again
  - In menu: `Functions` / `Update Playlists`
  - Grant access in the dialog
3. Setup your playlists and channels (white cells in the Sheet):
  - Your Playlist IDs (you can find it in the URLs of your playlists, after `?list=`)
  - Channels for the playlists

# Usage

##### Manual playlist update:

1. Open the Google Sheet, then in menu: `Functions` / `Update Playlists`. (Notice: when used first time, only a timestamp will be added (prevents overflow with old videos)).

##### Scheduled playlist update:

1. In menu (of the Sheet): `Tools` / `Script Editor...`
2. In menu: `Resources` / `Current project triggers`
3. `updatePlaylists` -> `Time driven` -> `Hour timer` -> `Every hour`
4. `Save`

##### (Extra) Link to remove all items:

To remove all playlist items, bookmark the link below and click on it while having the youtube playlist page open.

`javascript:(function() { if (confirm('Remove all?')) {var i = window.setInterval(function() {var closeButton = document.querySelector('.pl-video-edit-remove');    if (closeButton) {      closeButton.click();    } else {      window.clearInterval(i);    }}, 500);}})();` ([source](https://gist.github.com/timothyarmstrong/10501804))

# Feedback

[Official Reddit Thread](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/)
