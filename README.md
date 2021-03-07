# Description 
This is a Google Apps Script that automatically adds new Youtube videos to playlists (a replacement for Youtube Collections feature).

This is done using Google Sheets for interface, Google Script + Youtube API v3 for executing and scheduling.

[(Older version here)](https://github.com/Elijas/auto-youtube-subscription-playlist)

### Features

- Add all new videos to Youtube playlists (uploaded later than some date);

    - from all subscribed channels;

    - from any list of channels (by channel ID);

    - from any other playlist (by playlist ID);

- Set automatic interval for updates (optional);

- Deploy as a web app to update or show playlist (optional);

- Remove videos in the playlists that are older than a certain number of days before the execution of the script (optional).

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

2. Setup your playlists and channels (white cells in the Sheet):
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
    - Optionally add a number of days in the grey column (B). Videos in the playlist that have been published that many days before are going to be removed from the playlist.

3. Run the script:
      - In Sheet's menu: `Functions` / `Update Playlists`
      - Grant access in the dialog

4. (Optional) Adjust Timezone:
      - In menu (of the Sheet): `Tools` / `Script Editor...`
      - In script: `File` / `Project properties`
      ![](https://user-images.githubusercontent.com/17478849/80022886-b38eac00-84aa-11ea-8720-d486ca03bcea.png)
      - On tab: `Info` scroll down
      - Choose `Time zone` from dropdown
      - `Save`

# Usage

##### Manual playlist update:

1. Open the Google Sheet, then in menu: `Functions` / `Update Playlists`. (Notice: when used first time, only a timestamp will be added (prevents overflow with old videos)).

##### Scheduled playlist update:

1. In menu (of the Sheet): `Tools` / `Script Editor...`
2. In menu: `Resources` / `Current project triggers`
3. `updatePlaylists` -> `Time driven` -> `Hour timer` -> `Every hour`
4. `Save`

##### Deploy as a web app:

1. In menu (of the Sheet): `Tools` / `Script Editor...`
1. Click on `Deploy`
1. Use the cog beside `Select type`. Ensure `web app` is selected.
4. `Publish` (you will get a special link to use)
5. Optional - create a tiny.cc redirect link for easy acess (tiny.cc is recommended as it allows you to pass parameters to the url)
6. Usage: append `?pl=N` to select the Nth playlist in the spreadsheet.
  - append `?update=True` to force update all the playlists.
  - e.g. `tiny.cc/myplaylist?update=True&pl=3` will force update and open the third playlist.

#### (Extra) Link to remove all/watched items from a youtube playlist [here](./removeVidsFromPlaylist.md)

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
  - Open the `Script Editor` (in menu: `Tools` / `Script Editor...`) of the Sheet
      - In menu: `Resources` / `Advanced Google Services`
      - Scroll down and make sure `YouTube Data API` is enabled
  - Close the Developers Console and Script Editor, open the Sheet again

##### Q: I get this error: `Cannot query for user <USERNAME>` where `<USERNAME>` is the channel's username found in the channel's shortened URL (i.e. `youtube.com/c/<USERNAME>` or `youtube.com/user/<USERNAME>`

In the sheet, channel usernames cannot be used, only channel ids. To get a channel id for a specific channel, follow these steps:
1. click on any of the videos on the channel
2. click on the channel name
3. the URL now contains the ID instead of the username

![get url for custom chanels](https://user-images.githubusercontent.com/2620316/102909538-09b85280-4471-11eb-9828-5c2a52f71640.gif)

##### Q: I want to experiment with the error further

A: Copy-paste the contents of the debug.gs file into your Script Editor

##### Q: I have more questions.

A: See `Feedback` section below.

# Feedback

[Github Issue Board](https://github.com/Elijas/auto-youtube-subscription-playlist-2/issues)

[Official Reddit Thread](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/)

[Official Message Board](http://autoplaylistfeedback.boards.net/thread/2/general-thread)
