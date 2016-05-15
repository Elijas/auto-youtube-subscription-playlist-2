# Description [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CEGR3HNGE2RA2)
This is a Google Apps Script that automatically adds new Youtube videos to playlists (a replacement for Youtube Collections feature). 

This is done using Google Sheets for interface, Google Script + Youtube API v3 for executing and scheduling.

[(Older version here)](https://github.com/Elijas/auto-youtube-subscription-playlist)

# Features
1. Adds all new videos to Youtube playlists (uploaded later than some date)
  
  1.1. From ALL subscribed channels
  
  1.2. From any list of channels (by username or channel ID)
  
2. Optional - ability to set automatic interval for updates

# Set-up Instructions
1. [Copy](https://goo.gl/FMmDZR) the Sheet to your Google Drive.
2. Allow the Sheets to access Youtube:
  - Open the `Script Editor` (in menu: `Tools` / `Script Editor...`) of the Sheet
  - In menu: `Resources` / `Advanced Google Services` / `Google Developers Console` / `Youtube Data API` / `Enable API`
  - Close the Developers Console and Script Editor, open the Sheet again
  - In menu: `Functions` / `Update Playlists`
  - Grant access in the dialog
3. Setup your playlists and channels (white cells in the Sheet):
  - Clear all existing white rows, they are just examples (i.e. delete the 3 rows).
  - For each new playlist you want to use:
    - In a new row:
    - Add your Playlist ID in the first white column (you can find it in the URLs of your playlists, after `?list=`)
    - Add your Channels (in other white columns of the same row) ([Example of a successful set-up](https://gyazo.com/39ea428c97f5326ec5082712b9a306c0), from [topdogmsn](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/cwlfjop))
      - Any of the following:
      - User ID (last part (after last `/`) in `https://www.youtube.com/user/someusername`)
      - Channel ID (last part (after last `/`) in `https://www.youtube.com/channel/UCzMVH2jEyEwXPBvyht8xQNw`)
      - `ALL`, to add all new videos from all of your subscriptions

# Usage

##### Manual playlist update:

1. Open the Google Sheet, then in menu: `Functions` / `Update Playlists`. (Notice: when used first time, only a timestamp will be added (prevents overflow with old videos)).

##### Scheduled playlist update:

1. In menu (of the Sheet): `Tools` / `Script Editor...`
2. In menu: `Resources` / `Current project triggers`
3. `updatePlaylists` -> `Time driven` -> `Hour timer` -> `Every hour`
4. `Save`

##### (Extra) Link to remove all items from a youtube playlist:

To remove all playlist items, bookmark the link below and click on it while having the youtube playlist page open.

`javascript:(function() { if (confirm('Remove all?')) {var i = window.setInterval(function() {var closeButton = document.querySelector('.pl-video-edit-remove');    if (closeButton) {      closeButton.click();    } else {      window.clearInterval(i);    }}, 500);}})();` ([source](https://gist.github.com/timothyarmstrong/10501804))

##### (Extra) Link to remove watched items from a youtube playlist (thanks to [saso5tr](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/cy38z0f)):

Same as above.

`javascript:(function() { if (confirm('Remove all?')) {var i = window.setInterval(function() {var closeButton = document.querySelector('.watched-badge'); if (closeButton) { closeButton.parentElement.parentElement.parentElement.parentElement.querySelector('.pl-video-edit-remove').click(); } else { window.clearInterval(i); }}, 500);}})();`

# FAQ

##### Q: How do I solve this error: `TypeError: Second argument to Function.prototype.apply must be an array. (line 27, file "")`?

A: Do the step laid out in the instructions above: go to `Resources > Developers Console Project > Click the link to your API console project > On the left, APIs & Auth > APIs > YouTube Data API > Enable API`. (thanks to [josn0w](https://github.com/Elijas/auto-youtube-subscription-playlist-2/issues/1#issue-111149125) and [theit8514](https://github.com/Elijas/auto-youtube-subscription-playlist-2/issues/1#issuecomment-153812078), also [nmgoh](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/cx55gtc) and [saso5tr](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/cy38tkg))

##### Q: How to temporarily pause updating only some of the channels?

A: Cut (or delete) the contents of the playlist ID cell in the row you want to pause.

##### Q: Where can I support further development?

A: [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CEGR3HNGE2RA2)

##### Q: I have more questions.

A: See `Feedback` section below.

# Feedback

[Official Reddit Thread](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/)

[Official Message Board](http://autoplaylistfeedback.boards.net/thread/2/general-thread)
