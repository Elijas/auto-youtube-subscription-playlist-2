# Description 
This is a Google Apps Script that automatically adds new Youtube videos to playlists (a replacement for Youtube Collections feature).

This is done using Google Sheets for interface, Google Script + Youtube API v3 for executing and scheduling.

[(Older version here)](https://github.com/Elijas/auto-youtube-subscription-playlist)

### Features

- Add all new videos to Youtube playlists;
    - uploaded later than some date & time
        - if daily quota is exceeded, this automatically picks up where it left off on the next execution;
    - from all subscribed channels;
    - from any list of channels (by channel ID);
    - from any other playlist (by playlist ID);
- Set automatic interval for updates (optional);
- Deploy as a web app to update or show playlist (optional);
- Remove videos in the playlists that are older than a certain number of days before the execution of the script (optional).
    - simultaneously removes duplicates
- Remove videos less than 1 minute in length (e.g. shorts) (optional)

### (Extra) Scripts to easily remove multiple items from a youtube playlist [here](./removeVidsFromPlaylist.md)

# Where to get help

[![issuehunt](./docs/issuehunt-button-v1.svg)](https://issuehunt.io/r/Elijas/auto-youtube-subscription-playlist-2)

If you ran into problems, here are some of the possible sources for solutions:
- Troubleshooting section at the end of this README
- [Issues board in GitHub](https://github.com/Elijas/auto-youtube-subscription-playlist-2/issues)
    - You can [put bounties](https://issuehunt.io/r/Elijas/auto-youtube-subscription-playlist-2) on issues too
- Community support forum: [Official Message Board](http://autoplaylistfeedback.boards.net/thread/2/general-thread)
- 3rd party copies of the project (Forks)
    - If you'd like improve the code yourself: some issues were introduced with merges from 3rd party forks. Last commit before the merges can be found [here](https://github.com/Elijas/auto-youtube-subscription-playlist-2/blob/a53d0ea033d9a9aaf5e8832edfcffc10777701b3/sheetScript.gs)

# Set-up Instructions
1. [Copy](http://bit.ly/subscriptionPlaylistsCopy) the Sheet to your Google Drive. 
   Afterwards you might want to update the script to the latest version of sheetScript.gs

1. Setup your playlists and channels (white cells in the Sheet):
  - Clear all existing white rows, they are just examples (i.e. delete the 3 rows).
  - For each new playlist you want to use:
    - In a new row:
    - Add your Playlist ID in the first white column (you can find it in the URLs of your playlists, after `?list=`)
    - Add your Channels (in other white columns of the same row) ([Example of a successful set-up](https://gyazo.com/39ea428c97f5326ec5082712b9a306c0), from user `topdogmsn`)
      - Any of the following:
      - User ID (last part (after last `/`) in `https://www.youtube.com/user/someusername`)
      - Channel ID (last part (after last `/`) in `https://www.youtube.com/channel/UCzMVH2jEyEwXPBvyht8xQNw`)
      - Playlist ID (last part (after `?list=` in `https://www.youtube.com/playlist?list=PLd0LhgZxFkVKh_JNXcdHoPYo832Wu9fub`)
      - `ALL`, to add all new videos from all of your subscriptions
      - NOTE: custom URLs cannnot be used (i.e. the last part of `https://www.youtube.com/c/skate702`). Please get the channel's ID as described in the Troubleshooting section under `Cannot query for user <USERNAME>`
    - Optionally add a number of days in column C. The playlist in this row will not be updated until that many days have passed.
    - Optionally add a number of days in column D. Videos in the playlist that have been published that many days before are going to be removed from the playlist.
    - Optionally add `No` to column E to remove all new videos under 1 minute in length from being added to the playlist.

1. Run the script:
      - In Sheet's menu: `YouTube Controls` / `Update Playlists`
      - Grant access in the dialog

1. (Optional) Adjust Timezone:
      - In menu (of the Sheet): `Extensions` / `Apps Script`
      - If you don't see an `appsscript.json` file in the editor, got to `Project Settings` tab and select `
Show "appsscript.json" manifest file in editor`
      - Select `appsscript.json` in the editor
      - Change the string after `timeZone` to your timezone. Pick one from [this list](https://developers.google.com/adwords/api/docs/appendix/codes-formats#timezone-ids)
      ![image](https://user-images.githubusercontent.com/17478849/143072670-b5926552-94e5-4799-bee6-b348a40e69b0.png)
      - `Save Project`/`Ctrl+S`

# Usage

##### Manual playlist update:

1. Open the Google Sheet, then in menu: `Functions` / `Update Playlists`. (Notice: when used first time, only a timestamp will be added (prevents overflow with old videos)).

##### Scheduled playlist update:

1. In menu (of the Sheet): `Extensions` / `Apps Script`
1. Go to `Triggers` tab
1. Press the blue button in the lower right corner `+ Add Trigger`
1. Select `updatePlaylists` -> `Head` -> `Time driven` -> `Hour timer` -> `Every hour`
1. `Save`

##### Deploy as a web app:

1. In menu (of the Sheet): `Extensions` / `Apps Script`
1. Click on `Deploy` -> `New Deployment`
1. Use the cog beside `Select type`. Ensure `web app` is selected.
1. Click `Deploy` (you will get a special link to use)
1. Optional - create a tiny.cc redirect link for easy acess (tiny.cc is recommended as it allows you to pass parameters to the url)
1. Usage: append `?pl=N` to select the Nth playlist in the spreadsheet.
  - append `?update=True` to force update all the playlists.
  - e.g. `tiny.cc/myplaylist?update=True&pl=3` will force update and open the third playlist.

# Update script

Often, changes will be made to the script which you will need to add to your copy of the sheet. There are two ways to do this:
1. Get a new [copy](http://bit.ly/subscriptionPlaylistsCopy) of the sheet and copy your data from your old one to the new one
1. Edit the script in your existing sheet:
    - In menu (of the sheet) click on: `Extensions` / `Apps Script`
    - Replace the script (Code.gs) with the new script found [here](./sheetScript.gs)

# FAQ

##### Q: I followed the instructions and nothing happened?

A: Only videos that are uploaded after the first run of the script are added (i.e. the timestamp is set to current date). New videos should be up. Alternatively, you can modify the timestamp yourself.

##### Q: How to temporarily pause updating only some of the channels?

A: Cut (or delete) the contents of the playlist ID cell in the row you want to pause.

##### Q: I want to say thanks!

A: Feel free to buy me a cup of coffee here: [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RPRJ8UNWNWUK2). Although, I'd appreciate even more if you could help support other users and/or create pull requests for fixes and improvements!

[![ko-fi](https://www.ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Z8Z311X7D)

##### Q: I have more questions.

A: See `Feedback` section below.

# Troubleshooting

##### Q: Google keeps asking to authorize, even when I did so.

A: A known fix is to use an account with Gmail, YouTube accounts are known to have this issue. Notice that you will only be able to use the playlists accessible by the authorized account (i.e. your 'Gmail' account in YouTube site).

##### Q: I get this error: `TypeError: Second argument to Function.prototype.apply must be an array. (line 27, file "")`

A: Do the step laid out in the instructions above: go to `Resources > Developers Console Project > Click the link to your API console project > On the left, APIs & Auth > APIs > YouTube Data API > Enable API`. (thanks to [josn0w](https://github.com/Elijas/auto-youtube-subscription-playlist-2/issues/1#issue-111149125) and [theit8514](https://github.com/Elijas/auto-youtube-subscription-playlist-2/issues/1#issuecomment-153812078), also [nmgoh](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/cx55gtc) and [saso5tr](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/cy38tkg))


##### Q: I get this error [`TypeError: Cannot call method "toString" of undefined.`](https://i.stack.imgur.com/oDT5D.png)

A: See https://stackoverflow.com/a/48912679/1544154 (thanks to [LPanic](https://stackoverflow.com/users/5295765/lpanic))


##### Q: I get this error: `TypeError: Cannot read property "items" from undefined. (line 169, file "Code")`

A: If it only happens sometimes, it can be safely ignored, the next round will work normal again. If it happens on every execution, check your playlist and channel IDs. The script stops working if any of your playlists or channels doesn't exist, for example because it was deleted.

##### Q: I get `Quota` or `Cannot (Search) YouTube` errors

A: Make sure the sheet can access YouTube's API:
  - Open the `Script Editor` (in menu: `Extensions` / `Apps Script`) of the Sheet
      - Under the `Services` section, make sure `YouTube` is there, otherwise use the plus button beside `Services` and search for `YouTube Data API v3`.
  - Close the Developers Console and Script Editor, open the Sheet again

##### Q: I get this error: `Cannot query for user <USERNAME>` where `<USERNAME>` is the channel's username found in the channel's shortened URL (i.e. `youtube.com/c/<USERNAME>` or `youtube.com/user/<USERNAME>` or `youtube.com/@<USERNAME>`

In the sheet, channel usernames and custom URLs cannot be used, only channel ids. To get a channel id for a specific channel, use the `Get Channel ID` function in the custom menu. After inputting a channel's name and hitting Ok, it will give you channel URLs to verify it has found the right one. Once it's correct, click Yes and it will give you the channel ID, which you should then copy and paste into the spreadsheet.

##### Q: I want to experiment with the error further

A: Copy-paste the contents of the debug.gs file into your Script Editor

##### Q: I want to temporarily stop updating one playlist but I don't want to have to delete everything in that row

A: Add a `#` before the playlist in column A that you want to stop updating. The script ignores rows without a playlist or playlists that start with `#`. For example: `PLCiNIjl_KpQhFwQA3G19w1nmhEOlZQsGF` would become `#PLCiNIjl_KpQhFwQA3G19w1nmhEOlZQsGF`

##### Q: I have more questions.

A: See `Feedback` section below.

# Feedback

[Github Issue Board](https://github.com/Elijas/auto-youtube-subscription-playlist-2/issues)

[Official Reddit Thread](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/)

[Official Message Board](http://autoplaylistfeedback.boards.net/thread/2/general-thread)
