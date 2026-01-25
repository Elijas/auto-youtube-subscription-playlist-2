# Web App Feature Specification for Auto YouTube Subscription Playlist Tool

## Executive Summary

This document provides a comprehensive analysis of all current and requested features for the Auto YouTube Subscription Playlist tool. The goal is to design a new web app interface that allows for advanced features while maintaining simplicity for basic users.

**Current Interface:** Google Sheets with bound Apps Script  
**Target Interface:** Enhanced web application with progressive disclosure design pattern  
**Primary Challenge:** Balance feature richness with user-friendly simplicity

---

## Table of Contents

1. [Current Implemented Features](#current-implemented-features)
2. [Requested Features from GitHub Issues](#requested-features-from-github-issues)
3. [Additional Complementary Features](#additional-complementary-features)
4. [Feature Categorization for UI Design](#feature-categorization-for-ui-design)
5. [Interface Design Requirements](#interface-design-requirements)

---

## Current Implemented Features

### 1. Playlist Management

#### 1.1 Add Videos to Playlist
**Description:** Core functionality that automatically adds new YouTube videos to specified playlists.

**User Interaction:**
- User enters a Playlist ID in Column A of the spreadsheet (format: `PLxxxxxxxxxxxxxxxxx`)
- Playlist IDs can be found in YouTube playlist URLs after `?list=`
- Multiple playlists can be managed by adding rows

**Expected Outcome:**
- New videos from specified sources (channels, subscriptions, playlists) are automatically added to the target playlist
- Only videos published after the last update timestamp are added
- Maximum 200 videos per execution (quota limit protection)

**Technical Details:**
- Uses YouTube Data API v3 `PlaylistItems.insert()`
- Handles API errors (404 for private videos, 409 for duplicates)
- Cannot add to Watch Later or Watch History playlists (API limitation)

---

#### 1.2 Timestamp-Based Updates
**Description:** Tracks last update time to prevent duplicate video additions and manage incremental updates.

**User Interaction:**
- Column B (Last Update Timestamp) automatically populated on first run
- Initial timestamp set to 24 hours before first execution
- User can manually edit timestamp to control date range of videos to add
- Timestamp format: ISO 8601 with timezone (e.g., `2024-01-24T13:22:53.000-05:00`)

**Expected Outcome:**
- Only videos published after the timestamp are processed
- Timestamp automatically updates after successful execution
- Prevents adding entire channel history on first run

**Edge Cases:**
- Debug flag `debugFlag_dontUpdateTimestamp` prevents updates during testing
- Manual timestamp editing allows backfilling historical videos (up to 200 video limit)

---

#### 1.3 Scheduled Update Frequency
**Description:** Controls how often each playlist is automatically updated.

**User Interaction:**
- Column C (Frequency hours) - user enters number of hours between updates
- Empty value = update every execution
- Positive number = minimum hours before next update
- Works with hourly time-driven triggers set in Apps Script

**Expected Outcome:**
- Script checks if enough time has passed since last update
- Skips playlist update if frequency interval not met
- Logs "Skipped: Not time yet" when interval not reached

**Technical Details:**
- Calculation: `dateDiff = Date.now() - lastTimestamp`
- Comparison: `nextTime = frequency * MILLIS_PER_HOUR`
- Update if: `dateDiff > nextTime`

---

#### 1.4 Auto-Delete Old Videos
**Description:** Automatically removes videos from playlist after a specified number of days.

**User Interaction:**
- Column D (Delete days) - user enters number of days
- Videos older than this many days are removed from playlist
- Based on video's original publication date, not when added to playlist
- Empty or 0 = no deletion

**Expected Outcome:**
- Videos published more than N days ago are removed from playlist
- Duplicate videos (same videoId) are also removed during this process
- Helps keep playlists fresh and manageable

**Technical Details:**
- Uses `YouTube.PlaylistItems.remove()`
- Compares `item.contentDetails.videoPublishedAt` to `deleteBeforeTimestamp`
- Also checks `publishedBefore` parameter in API call

---

### 2. Video Source Management

#### 2.1 Channel ID Input
**Description:** Add videos from specific YouTube channels by channel ID.

**User Interaction:**
- Columns F onwards - user enters channel IDs
- Format: `UCxxxxxxxxxxxxxxxxx` (24 characters starting with UC)
- Multiple channels per playlist by adding to adjacent columns
- Channel ID found in channel URL: `youtube.com/channel/UCxxxxxxxxxxxxxxxxx`

**Expected Outcome:**
- All new videos from specified channels are added to playlist
- Videos must be public (private videos trigger 404 but don't cause errors)
- Uses channel's uploads playlist for efficiency

**Technical Details:**
- Validates channel exists using `YouTube.Channels.list('id')`
- Retrieves uploads playlist: `results.items[0].contentDetails.relatedPlaylists.uploads`
- Filters videos by publication date

---

#### 2.2 Username Input
**Description:** Add videos from channels using legacy YouTube usernames.

**User Interaction:**
- Columns F onwards - user enters username (any string not starting with "UC", "PL", or "ALL")
- Username from URL: `youtube.com/user/someusername`
- Script automatically resolves username to channel ID

**Expected Outcome:**
- Username is converted to channel ID via API
- Videos from that channel are added to playlist
- Error logged if username doesn't exist or is ambiguous

**Technical Details:**
- Uses `YouTube.Channels.list('id', {forUsername: channel})`
- Validates exactly one result returned
- Note: Custom URLs (`youtube.com/c/customname`) are NOT supported

---

#### 2.3 ALL Keyword (Subscription Auto-Add)
**Description:** Special keyword to add videos from all user's YouTube subscriptions.

**User Interaction:**
- Enter `ALL` (case-sensitive) in any channel column
- One `ALL` keyword processes all subscriptions for that playlist
- Most popular feature for creating a "master" playlist

**Expected Outcome:**
- Script retrieves all channels user is subscribed to
- New videos from all subscriptions are added to playlist
- Supports up to 1000 subscriptions (API pagination limit)

**Technical Details:**
- Uses `YouTube.Subscriptions.list('snippet')` with pagination
- 50 results per page, max 20 pages
- Workaround for nextPageToken API bug (hardcoded token list)

---

#### 2.4 Playlist Mirroring (Playlist ID Input)
**Description:** Mirror/copy videos from another playlist into target playlist.

**User Interaction:**
- Columns F onwards - user enters playlist ID
- Format: `PLxxxxxxxxxxxxxxxxx` (starts with PL, length > 10)
- Useful for combining multiple playlists or mirroring community playlists

**Expected Outcome:**
- New videos added to source playlist are copied to target playlist
- Only videos added after last timestamp are copied
- Allows creating aggregated playlists from multiple sources

**Technical Details:**
- Uses `YouTube.PlaylistItems.list('snippet')` 
- Filters by `publishedAfter` timestamp
- Validates playlist exists before processing

---

### 3. Execution and Control Features

#### 3.1 Manual Playlist Update
**Description:** Trigger immediate update of all playlists via Google Sheets menu.

**User Interaction:**
- Open Google Sheet
- Menu: `YouTube Controls` > `Update Playlists`
- First-time users must authorize OAuth scopes

**Expected Outcome:**
- All playlists in spreadsheet are processed sequentially
- Timestamps updated on success
- Errors logged to Debug sheet
- Execution completes or throws error with count of failed videos

**Technical Details:**
- Entry point: `updatePlaylists(sheet)` function
- Iterates through rows starting at `reservedTableRows` (row 3, 0-indexed)
- Uses `errorflag` to prevent timestamp updates on errors

---

#### 3.2 Scheduled Time-Driven Updates
**Description:** Automatically run updates on a recurring schedule using Apps Script triggers.

**User Interaction:**
- Apps Script Editor > Triggers tab > Add Trigger
- Select: `updatePlaylists` → `Time-driven` → `Hour timer` → `Every hour` (or other interval)
- Requires sheet ID stored in Script Properties

**Expected Outcome:**
- Script runs automatically without user intervention
- Frequency controls in Column C prevent excessive API usage
- 6-minute execution timeout for time-driven triggers (vs 30 minutes manual)

**Technical Details:**
- Uses `PropertiesService.getScriptProperties()` to retrieve sheet ID
- `onOpen()` function stores sheet ID on first manual run
- Opens sheet by ID: `SpreadsheetApp.openById(sheetID)`

---

#### 3.3 Web App Deployment
**Description:** Deploy script as a web application for viewing playlists and triggering updates.

**User Interaction:**
- Deploy from Apps Script Editor: `Deploy` > `New Deployment` > `Web app`
- Access via deployment URL with query parameters:
  - `?update=True` - force update all playlists before displaying
  - `?pl=N` - display Nth playlist (1-indexed, user-facing numbering)
  - Combined: `?update=True&pl=3` - update and show 3rd playlist

**Expected Outcome:**
- Opens HTML page with embedded YouTube playlist player
- Shows selected playlist in iframe
- Can trigger updates without opening spreadsheet
- Includes bookmarklet for removing watched videos from playlist

**Technical Details:**
- Entry point: `doGet(e)` function
- Uses `HtmlService.createTemplateFromFile('index.html')`
- Template variables: `data` (playlist index), `sheetID`
- Playlist selected via `playlist(pl, sheetID)` helper function

---

### 4. Debug and Error Handling

#### 4.1 Debug Logging System
**Description:** Comprehensive logging system that captures execution details for troubleshooting.

**User Interaction:**
- Hidden sheet `DebugData` stores raw logs
- Visible sheet `Debug` displays formatted logs
- Column A shows timestamps, Column B shows log messages
- Cell B1 controls number of executions to display

**Expected Outcome:**
- Every script execution logged with timestamp
- Errors, warnings, and info messages captured
- Logs organized chronologically
- User can review historical executions

**Technical Details:**
- Uses `Logger.log()` for all messages
- `Logger.getLog()` retrieves logs for current execution
- Cyclic column usage: 900 rows per column, 26 columns total
- `getLogs(timestamp)` function retrieves logs for specific execution

---

#### 4.2 Error Handling and Reporting
**Description:** Robust error handling that logs issues without stopping entire execution.

**User Interaction:**
- Errors logged to Debug sheet
- Script continues processing remaining playlists after errors
- Final error count thrown if any videos failed to add
- Timestamps not updated for rows with errors

**Expected Outcome:**
- User can identify which playlists/channels have issues
- Script doesn't fail completely due to one bad channel ID
- Error messages include API details for troubleshooting

**Technical Details:**
- `addError(s)` function logs error and sets `errorflag`
- Row-level: `errorflag` prevents timestamp update
- Playlist-level: `plErrorCount` tracks errors per playlist
- Script-level: `totalErrorCount` determines if exception thrown

---

#### 4.3 Debug Flags
**Description:** Developer flags to test script behavior without modifying playlists or timestamps.

**User Interaction:**
- Set at top of `sheetScript.gs` file
- Must be manually edited in Apps Script Editor
- Not exposed to end users in current interface

**Available Flags:**
```javascript
debugFlag_dontUpdateTimestamp = false   // Prevent timestamp changes
debugFlag_dontUpdatePlaylists = false   // Dry run - don't add videos
debugFlag_logWhenNoNewVideosFound = true // Verbose logging
```

**Expected Outcome:**
- `dontUpdateTimestamp`: Can re-run script with same timestamp for testing
- `dontUpdatePlaylists`: See what would happen without actual changes
- `logWhenNoNewVideosFound`: Identify inactive channels

**Use Cases:**
- Testing channel ID validity
- Verifying API quota usage
- Debugging timestamp logic

---

### 5. Quota Management

#### 5.1 Video Limit (200 videos per execution)
**Description:** Hard limit to prevent YouTube API quota exhaustion.

**User Interaction:**
- No direct user control
- Script refuses to add more than 200 videos at once
- Error logged: "Script cannot add more than 200 videos"

**Expected Outcome:**
- Prevents quota overflow
- User must adjust timestamp to smaller date range if exceeded
- API quota: 10,000 units/day default

**Technical Details:**
- Check in `addVideosToPlaylist()`: `if (totalVids > maxVideos)`
- Variable: `maxVideos = 200` (adjustable at top of script)
- YouTube API costs: Search = 100 units, Playlist operations = 50 units

---

#### 5.2 Quota-Efficient Video Retrieval
**Description:** Two methods for retrieving videos, with different quota costs.

**User Interaction:**
- No user control - automatically uses efficient method
- Alternative method available if needed: `getVideoIds()` (commented in code)

**Current Method: `getVideoIdsWithLessQueries()`**
- Uses channel's uploads playlist
- Cost: 3 units per channel
- Slower but quota-efficient
- Date ordering less precise

**Alternative Method: `getVideoIds()` (not used)**
- Uses YouTube Search API
- Cost: 100 units per channel
- Faster, better date ordering
- Higher quota consumption

**Expected Outcome:**
- Default method conserves quota
- Can process more channels per day
- Trade-off: slightly slower execution

---

### 6. Playlist Maintenance

#### 6.1 Duplicate Video Removal
**Description:** Automatically removes duplicate videos (same videoId) from playlists during deletion process.

**User Interaction:**
- Automatic during delete operation (Column D)
- No user configuration required
- Runs whenever delete days feature is used

**Expected Outcome:**
- Only one instance of each video remains in playlist
- Keeps playlists clean
- Reduces playlist clutter from re-added videos

**Technical Details:**
- Implemented in `deletePlaylistItems()` function
- Uses JavaScript array filtering to find duplicates

---

#### 6.2 Private Video Handling
**Description:** Gracefully handles private, deleted, or unavailable videos.

**User Interaction:**
- No user action required
- Script detects and logs private videos
- Error count not incremented for private videos

**Expected Outcome:**
- Private videos don't cause script failures
- Log message: "Cannot find video, most likely private"
- Script continues processing other videos

**Technical Details:**
- 404 error caught during `YouTube.PlaylistItems.insert()`
- Validates with `YouTube.Videos.list('snippet')` to confirm video doesn't exist
- Special handling: `errorCount` does not increase for private videos

---

### 7. Additional Utilities

#### 7.1 Remove Videos from Playlist (Bookmarklets)
**Description:** JavaScript bookmarklets to manually remove videos from playlists in YouTube's web interface.

**User Interaction:**
- Documented in `removeVidsFromPlaylist.md`
- Create browser bookmark with JavaScript code
- Click bookmarklet while on YouTube playlist page

**Available Bookmarklets:**
1. Remove all videos
2. Remove all watched videos
3. Remove specified number of videos
4. Remove videos matching keyword/regex

**Expected Outcome:**
- Bulk playlist management in YouTube UI
- Workaround for YouTube's lack of bulk delete features
- Useful for manual cleanup tasks

**Technical Details:**
- Bookmarklets inject JavaScript into YouTube page
- Query DOM for playlist video elements
- Simulate clicks on menu buttons
- May break if YouTube HTML structure changes

---

#### 7.2 Timezone Configuration
**Description:** Set script's timezone for accurate timestamp handling.

**User Interaction:**
- Edit `appsscript.json` in Apps Script Editor
- Change `timeZone` field to desired timezone code
- Use timezone codes from Google's list

**Expected Outcome:**
- Timestamps in logs match user's local time
- Correct ISO date strings with timezone offset
- Affects `Date.toIsoString()` custom prototype

**Technical Details:**
- Requires `appsscript.json` visible in editor settings
- Format: `"timeZone": "America/New_York"`
- Custom date prototype extends JavaScript Date object

---

#### 7.3 Script Update Mechanism
**Description:** Process for updating to latest script version.

**User Interaction:**
- Two options:
  1. Get new sheet copy and transfer data
  2. Replace Code.gs content in Apps Script Editor

**Expected Outcome:**
- User has latest features and bug fixes
- Existing data and configuration preserved (option 2)
- Triggers and deployments remain intact (option 2)

**Considerations:**
- Manual process - no auto-update
- Users must monitor GitHub for updates
- Breaking changes require migration steps

---

## Requested Features from GitHub Issues

### High Priority - Filter Features

#### F1. Filter Member-Only Content and Live Streams (#138)
**Status:** Requested  
**Opened:** Oct 16, 2024

**Description:** Ability to exclude members-only videos and live streams from being added to playlists.

**User Need:**
- Members-only content not accessible to all viewers
- Live streams may not be relevant after they end
- Users want curated playlists with only standard uploaded content

**Proposed User Interaction:**
- Checkbox/toggle per playlist: "Exclude members-only content"
- Checkbox/toggle per playlist: "Exclude live streams"
- Could be separate columns in sheet or settings in web UI

**Expected Outcome:**
- Videos with member-only access are detected and skipped
- Live stream videos are identified and optionally excluded
- Regular uploaded videos still added normally

**Technical Considerations:**
- Need to check video `snippet.liveBroadcastContent` (values: `none`, `upcoming`, `live`, `completed`)
- Member-only detection may require checking `contentDetails` or `status` properties
- May need additional API quota for video details lookup

---

#### F2. Filter Upcoming Videos (#132)
**Status:** Requested (Enhancement)  
**Opened:** Apr 27, 2024

**Description:** Exclude scheduled/upcoming videos that haven't premiered yet.

**User Need:**
- Upcoming videos show in search results but can't be watched
- Users want only watchable content in playlists
- Prevents broken playlist entries

**Proposed User Interaction:**
- Checkbox: "Exclude upcoming/scheduled videos"
- Or: Wait until video actually premieres before adding

**Expected Outcome:**
- Videos with premiere scheduled in future are skipped
- Videos automatically added after premiere time
- Playlists contain only currently watchable content

**Technical Considerations:**
- Check `snippet.liveBroadcastContent === "upcoming"`
- Alternative: Add video but include grace period check
- Related to issue #92 (scheduled videos added early)

---

#### F3. Feature: Filters by Tag, Name, Length (#123)
**Status:** Requested  
**Opened:** Jul 3, 2023

**Description:** Advanced filtering capabilities based on video metadata.

**Sub-features:**
1. **Tag/Category Filter**
   - Include/exclude videos with specific tags
   - Use YouTube categories
   
2. **Title Filter (#69 - Feb 23, 2020)**
   - Include videos matching title keywords
   - Exclude videos matching title keywords
   - Regex pattern support

3. **Duration Filter**
   - Exclude shorts (< 60 seconds)
   - Min/max duration thresholds
   - Keep only long-form content

**User Need:**
- Fine-grained control over playlist content
- Different users want different content types
- Ability to exclude specific topics or video formats

**Proposed User Interaction:**
- Per-playlist filter rules:
  - Include titles matching: `[regex pattern]`
  - Exclude titles matching: `[regex pattern]`
  - Min duration: `[seconds]`
  - Max duration: `[seconds]`
  - Include tags: `[comma-separated list]`
  - Exclude tags: `[comma-separated list]`

**Expected Outcome:**
- Videos filtered based on all enabled criteria
- AND logic between different filter types
- OR logic within same filter type (e.g., multiple include patterns)

**Technical Considerations:**
- Requires `contentDetails` part in API calls (adds quota cost)
- Video duration in `contentDetails.duration` (ISO 8601 format)
- Tags in `snippet.tags` array
- Title in `snippet.title`
- May need batched video details lookup to minimize quota

---

#### F4. Skip and Add Later Premieres (#40)
**Status:** Requested (Enhancement)  
**Opened:** Oct 3, 2018

**Description:** Handle premiere videos that appear in feed before they're watchable.

**User Need:**
- Premieres show up hours before actual premiere time
- Adding them early creates unwatchable playlist entries
- Users want videos added only when watchable

**Proposed User Interaction:**
- Setting: "Delay adding premieres until [X] minutes after scheduled time"
- Or: Automatically detect and defer

**Expected Outcome:**
- Premiere videos detected and held back
- Videos added to playlist after premiere completes
- No unwatchable entries in playlist

**Technical Considerations:**
- Similar to #132 (upcoming videos)
- Check `snippet.liveBroadcastContent` and `liveStreamingDetails.scheduledStartTime`
- May need to track deferred videos separately

---

#### F5. Exclude YouTube Shorts (#169 - Column E in Current Sheet)
**Status:** IMPLEMENTED (partially)  
**Evidence:** Column E "Shorts? (No)" visible in sheet screenshot

**Description:** Option to exclude YouTube Shorts from playlists.

**User Need:**
- Shorts are different format (vertical, < 60 sec)
- Not suitable for playlist viewing experience
- Users want traditional videos only

**Current Implementation:**
- Column E labeled "Shorts? (No)"
- Implementation status unclear from code review

**Proposed Enhancement:**
- Ensure robust Shorts detection
- Boolean toggle per playlist
- Could combine with duration filter

**Technical Considerations:**
- Shorts detected by duration (< 60 seconds)
- No explicit "shorts" flag in API
- Must fetch `contentDetails.duration`

---

### Medium Priority - Operational Features

#### F6. Add Videos Between Two Dates (#129)
**Status:** Requested (Enhancement)  
**Opened:** Apr 10, 2024

**Description:** Specify date range (start and end) for videos to add, rather than just "after timestamp".

**User Need:**
- Backfill historical videos from specific time period
- Create retrospective playlists
- More control than single timestamp

**Proposed User Interaction:**
- Additional column: "End Date/Timestamp"
- Videos added if: `Start Date <= Published Date <= End Date`
- Empty end date = no upper limit (current behavior)

**Expected Outcome:**
- Videos from specific date range added to playlist
- Can create "Best of 2023" type playlists
- Multiple runs with different ranges possible

**Technical Considerations:**
- Add `publishedBefore` parameter to API calls
- May need to increase `maxVideos` limit for large ranges
- Consider quota implications

---

#### F7. Limit Number of Videos to Import per Channel (#76)
**Status:** Requested (Enhancement)  
**Opened:** May 8, 2020

**Description:** Set maximum number of videos to add per channel per execution.

**User Need:**
- Some channels upload frequently (multiple videos per day)
- Prevents one prolific channel from dominating playlist
- Better balanced playlist across all channels

**Proposed User Interaction:**
- Global setting: "Max videos per channel: [number]"
- Or per-playlist setting
- Default: unlimited (current behavior)

**Expected Outcome:**
- Maximum N videos added per channel, per execution
- Oldest videos prioritized (by publish date)
- Subsequent executions add remaining videos

**Technical Considerations:**
- Slice video array per channel: `videoIds.slice(0, maxPerChannel)`
- Timestamp still updates to latest check time
- May need per-channel timestamp tracking for full solution

---

#### F8. Catch and Restore Videos on Quota Error (#52)
**Status:** Requested (Enhancement)  
**Opened:** Jan 31, 2020

**Description:** When quota limit reached, save state and resume later without losing progress.

**User Need:**
- Quota errors cause partial updates
- Lost progress frustrating
- Want graceful degradation

**Proposed User Interaction:**
- Automatic - no user action required
- Notification when quota limit hit
- Resume on next scheduled run

**Expected Outcome:**
- Quota error caught and logged
- Videos pending addition saved
- Next execution continues from saved state
- No duplicate additions

**Technical Considerations:**
- Store pending videos in Script Properties or separate sheet
- Quota error detection: `e.message` contains "quota"
- Resume logic: Check for pending videos before normal execution
- Complex state management

---

#### F9. Automatically Add and Delete Script Triggers to Bypass Timeout (#54)
**Status:** Requested (Enhancement)  
**Opened:** Feb 8, 2020

**Description:** When script approaches 6-minute timeout, schedule continuation trigger and exit gracefully.

**User Need:**
- Time-driven triggers limited to 6 minutes execution
- Large channel lists or many playlists may exceed limit
- Current workaround: manual trigger with 30-minute limit

**Proposed User Interaction:**
- Automatic - no user intervention
- Setting: "Enable automatic continuation" (default: on)
- Status indicator: "Processing... (page 2 of 3)"

**Expected Outcome:**
- Script monitors execution time
- At 5:30, saves state and creates new trigger
- New trigger runs shortly after (e.g., 2 minutes)
- Process continues until completion

**Technical Considerations:**
- Use `ScriptApp.newTrigger()` to create time-based trigger
- Save current row index in Script Properties
- Delete trigger after continuation completes
- Risk: Trigger accumulation if not cleaned up properly

---

### Low Priority - User Experience

#### F10. Verify App (#65)
**Status:** Requested  
**Opened:** Feb 8, 2020

**Description:** Get Google verification for app to remove "unverified app" warnings during OAuth.

**User Need:**
- OAuth warning scares users
- Appears untrustworthy
- Hinders adoption

**Expected Outcome:**
- No scary warning screens
- Trusted app status
- Easier onboarding

**Technical Considerations:**
- Requires submitting app to Google for review
- Must provide privacy policy, terms of service
- Time-consuming process
- May have ongoing compliance requirements

---

#### F11. No Error When Input Playlist Empty (#126)
**Status:** Requested  
**Opened:** Dec 10, 2023

**Description:** Handle empty playlist IDs gracefully without errors.

**User Need:**
- Users want to prepare rows in advance
- Empty rows shouldn't cause errors
- More forgiving user experience

**Current Behavior:**
- Empty playlist ID cells likely skipped
- Code check: `if (!playlistId) continue;` (line 96)

**Status:** Likely already implemented correctly

---

#### F12. Silly Question (#119)
**Status:** Question (Community Support)  
**Opened:** Jun 9, 2023

**Description:** User question, not a feature request.

**Resolution:** Point to documentation or support channels.

---

#### F13. I Can't Authorize Sending Emails (#121)
**Status:** Issue Report  
**Opened:** May 16, 2023

**Description:** User having OAuth authorization problems.

**Resolution:** Documentation or troubleshooting guidance. Not a feature request.

---

### Critical Bugs to Address

#### B1. Can't Handle Videos Scheduled for Later Added Early (#92)
**Status:** Bug  
**Opened:** Jun 1, 2021

**Description:** Scheduled videos appear in channel uploads before premiere time but can't be played.

**Problem:**
- Scheduled videos have publication date in future
- Script adds them based on scheduled time
- Creates unwatchable playlist entries
- Related to #132 and #40

**Proposed Fix:**
- Check `snippet.liveBroadcastContent` before adding
- Skip videos with `"upcoming"` status
- Or add delay mechanism

---

#### B2. Cannot Update Playlist for Brand Account Using Personal Account (#47)
**Status:** Compatibility Issue  
**Opened:** Oct 28, 2019

**Description:** Can't manage playlists for YouTube Brand Accounts when authenticated with personal Google account.

**Problem:**
- Brand accounts have separate permissions
- Personal account may not have API access to brand playlists
- OAuth scope limitations

**Workaround:**
- Authenticate with Google account that owns brand account
- May require using brand account email if available

**Long-term Solution:**
- Provide guidance in docs
- Consider delegated access patterns

---

#### B3. Doesn't Work with Non-Gmail YouTube Accounts (#11)
**Status:** Known Limitation  
**Opened:** Nov 27, 2018

**Description:** Script requires Gmail-based Google account, doesn't work with standalone YouTube accounts.

**Problem:**
- YouTube-only accounts have different authentication
- Apps Script primarily designed for Google Workspace
- OAuth flow may not support YouTube-only accounts

**Current Workaround:**
- Create Gmail account
- Link YouTube channel to Gmail account
- Use Gmail account for authentication

**Resolution:**
- Document limitation clearly
- Provide migration guidance
- May not be fixable due to platform constraints

---

### Test Infrastructure

#### T1. Add Basic Tests (#77)
**Status:** Enhancement (Developer Experience)  
**Opened:** May 19, 2020

**Description:** Implement automated testing for script functions.

**Purpose:**
- Prevent regressions
- Validate changes
- Improve code quality

**Proposed Implementation:**
- Unit tests for helper functions
- Mock YouTube API responses
- Integration tests for main workflows
- Continuous integration setup

**Challenges:**
- Apps Script testing infrastructure limited
- No built-in test framework
- Would need external testing approach

---

## Additional Complementary Features

### A1. Playlist Statistics Dashboard
**Status:** New Proposal

**Description:** Display analytics about playlists, videos, and script performance.

**Features:**
- Total videos in playlist
- Videos added in last 24 hours / 7 days / 30 days
- Most active channels
- API quota usage tracking
- Execution history and success rate
- Average execution time

**User Benefit:**
- Understand playlist growth
- Identify issues proactively
- Optimize channel selections

---

### A2. Channel Preview Before Adding
**Status:** New Proposal

**Description:** Test/preview what videos would be added from a channel without actually adding them.

**Features:**
- Enter channel ID
- See list of videos that would be added
- Show video titles, thumbnails, durations
- "Looks good? Click to add channel to playlist row"

**User Benefit:**
- Validate channel IDs before committing
- Preview content before polluting playlist
- Confidence in configuration

---

### A3. Bulk Playlist Configuration
**Status:** New Proposal

**Description:** Configure multiple playlists at once with shared settings.

**Features:**
- Templates for common configurations
- "Apply settings to all playlists"
- Copy settings from one playlist to another
- Import/export configurations

**User Benefit:**
- Faster setup for users with many playlists
- Consistency across configurations
- Easy to share configurations with community

---

### A4. Notification System
**Status:** New Proposal

**Description:** Send notifications about script execution results.

**Features:**
- Email notifications on errors
- Digest emails (daily/weekly summary)
- Success confirmations
- Quota warning alerts

**User Benefit:**
- Proactive error awareness
- Don't need to check Debug sheet manually
- Peace of mind that script is working

**Technical Considerations:**
- Use `MailApp.sendEmail()` or `GmailApp`
- Respect user preferences (opt-in)
- Rate limiting to prevent spam

---

### A5. Video Quality Filter
**Status:** New Proposal

**Description:** Filter videos by quality/resolution (e.g., only 1080p+).

**Features:**
- Minimum resolution setting
- Exclude low-quality videos
- Option to require specific codecs

**User Benefit:**
- Curate high-quality content
- Consistent viewing experience
- Exclude low-effort uploads

**Technical Considerations:**
- Requires `contentDetails` API calls (quota cost)
- May not be available in all API responses
- Quality may change after upload (processing time)

---

### A6. Smart Playlist Ordering
**Status:** New Proposal

**Description:** Control order of videos in playlist beyond chronological.

**Features:**
- Newest first (current behavior)
- Oldest first
- Random shuffle
- By channel (grouped)
- Custom sort rules

**User Benefit:**
- Better viewing experience
- Discovery of older content
- Variety in playlist

**Technical Considerations:**
- YouTube API requires adding at specific position
- Reordering existing playlist is complex
- May require complete playlist rebuild

---

### A8. Playlist Templates
**Status:** New Proposal

**Description:** Pre-configured templates for common use cases.

**Templates:**
1. "All My Subscriptions" - Single playlist with ALL keyword
2. "Music Only" - Title filter for music keywords, duration filter
3. "Tutorials & Education" - Specific channels + length requirements
4. "Daily Digest" - All subscriptions, delete after 1 day
5. "Best of the Week" - 7-day window, longer videos only

**User Benefit:**
- Quick setup for new users
- Learn by example
- Best practices built-in

---

### A9. Video Metadata Enrichment
**Status:** New Proposal

**Description:** Store additional video metadata for advanced features.

**Metadata to Store:**
- View count
- Like/dislike ratio (if available)
- Comment count
- Channel subscriber count at time of addition
- Video category

**Use Cases:**
- Filter by popularity
- Track video performance over time
- Create "viral videos" playlist
- Analytics on content trends

**Technical Considerations:**
- Requires additional API calls (quota cost)
- Need storage mechanism (separate sheet?)
- Data becomes stale quickly

---

### A10. Dry Run Mode (Global)
**Status:** Enhancement to Existing Debug Flag

**Description:** User-accessible dry run mode in web interface.

**Features:**
- Toggle in web UI: "Preview changes without applying"
- Shows what would be added/removed
- No timestamp updates
- No API write operations

**User Benefit:**
- Safe testing of configurations
- Verify before committing
- Learn how script works

**Technical Implementation:**
- Expose existing `debugFlag_dontUpdatePlaylists` flag
- Add web UI control
- Store in Script Properties
- Reset after execution

---

### A11. Channel Group Management
**Status:** New Proposal

**Description:** Create named groups of channels for reuse across playlists.

**Features:**
- Define groups: "Tech Channels", "Music Channels", "Gaming"
- Reference group by name in playlist config
- Manage groups centrally
- Edit group affects all playlists using it

**User Benefit:**
- DRY principle (Don't Repeat Yourself)
- Easier to maintain channel lists
- Consistent across playlists

**Technical Implementation:**
- Separate sheet tab for groups
- Parse group names in channel columns
- Expand groups at runtime

---

### A12. Undo/History Feature
**Status:** New Proposal

**Description:** Track changes to playlists and allow reverting.

**Features:**
- Record what videos were added/removed each execution
- "Undo last execution" button
- View history of changes
- Export change log

**User Benefit:**
- Recover from mistakes
- Audit trail
- Confidence to experiment

**Technical Considerations:**
- Significant storage requirements
- Need to track video IDs and playlist item IDs
- Undo may fail if videos deleted by other means

---

## Feature Categorization for UI Design

### Tier 1: Core Features (Always Visible)
**User Type:** All users  
**Visibility:** Main interface, prominent placement

1. Playlist ID input
2. Video source selection (Channels/ALL/Playlists)
3. Manual update trigger
4. View playlist button
5. Last update timestamp (read-only)

**Rationale:** Essential for basic functionality, needed by every user.

---

### Tier 2: Common Features (Default Visible, Collapsible)
**User Type:** Majority of users  
**Visibility:** Visible by default, can be collapsed

1. Update frequency setting
2. Auto-delete old videos (days)
3. Exclude YouTube Shorts
4. Basic title filter (include/exclude keywords)

**Rationale:** Frequently used, enhance experience but not required.

---

### Tier 3: Advanced Features (Collapsed by Default)
**User Type:** Power users  
**Visibility:** Hidden under "Advanced Settings" or similar

1. Filter member-only content
2. Filter live streams
3. Filter upcoming/scheduled videos
4. Duration filters (min/max)
5. Tag filters
6. Video quality filters
7. Date range (start/end dates)
8. Videos per channel limit
9. Regex title patterns

**Rationale:** Niche use cases, can overwhelm casual users if always visible.

---

### Tier 4: Admin/Developer Features (Separate Section)
**User Type:** Administrators, troubleshooters  
**Visibility:** Separate "Debug/Admin" tab or section

1. Debug logs viewer
2. Error reports
3. API quota usage
4. Dry run mode
5. Manual timestamp edit
6. Execution statistics
7. Script configuration
8. OAuth re-authorization

**Rationale:** Technical features, not needed for normal operation.

---

## Interface Design Requirements

### 1. Progressive Disclosure Pattern
**Principle:** Show simple interface by default, reveal complexity on demand.

**Implementation:**
- Main screen: Tier 1 features only
- Expandable sections for Tier 2 features
- "Advanced Settings" button for Tier 3
- Separate "Admin/Debug" page for Tier 4

**Benefits:**
- New users not overwhelmed
- Power users can access everything
- Scales well as features grow

---

### 2. Playlist Management View

**Primary Interface:**
```
[+ New Playlist] [Import Configuration] [Export Configuration]

┌─ Playlist 1: My Daily Videos ────────────────────────────┐
│ Playlist ID: PLxxx...                                     │
│ Sources: 3 channels, ALL subscriptions                    │
│ Last Updated: 2 hours ago                                 │
│ Videos in Playlist: 47                                    │
│ [▶ View] [⚙ Settings] [🗑 Delete] [📊 Stats]             │
└───────────────────────────────────────────────────────────┘

┌─ Playlist 2: Music Videos ───────────────────────────────┐
│ Playlist ID: PLyyy...                                     │
│ Sources: 5 channels                                       │
│ Last Updated: 5 hours ago (Next: in 1 hour)              │
│ Videos in Playlist: 23                                    │
│ [▶ View] [⚙ Settings] [🗑 Delete] [📊 Stats]             │
└───────────────────────────────────────────────────────────┘

[Update All Playlists Now]
```

**Rationale:** Card-based layout, one card per playlist, key info at a glance.

---

### 3. Playlist Settings Modal

**When user clicks ⚙ Settings:**

```
┌─ Edit Playlist Settings ─────────────────────────────────┐
│                                                            │
│ Playlist ID: [PLxxx...]                          [Verify] │
│                                                            │
│ VIDEO SOURCES                                              │
│ ┌────────────────────────────────────────────────────┐   │
│ │ [ALL] All my subscriptions                          │   │
│ │ [UCxxx] Channel Name 1                      [Remove]│   │
│ │ [PLyyy] Playlist Name                       [Remove]│   │
│ │ [+ Add Channel/Playlist]                            │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ UPDATE SCHEDULE                                            │
│ [✓] Auto-update every [6] hours                           │
│                                                            │
│ AUTOMATIC DELETION                                         │
│ [✓] Remove videos older than [7] days                     │
│                                                            │
│ BASIC FILTERS                                              │
│ [✓] Exclude YouTube Shorts (< 60 seconds)                 │
│ [ ] Exclude live streams                                  │
│ [ ] Exclude member-only content                           │
│                                                            │
│ [▼ Show Advanced Filters]                                 │
│                                                            │
│ [Cancel] [Save Changes]                                   │
└────────────────────────────────────────────────────────────┘
```

**Advanced Filters Section (when expanded):**
```
│ ADVANCED FILTERS                                           │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Duration:                                           │   │
│ │   Min: [___] seconds   Max: [___] seconds          │   │
│ │                                                     │   │
│ │ Title Filters:                                      │   │
│ │   Include: [_____________________________]         │   │
│ │   Exclude: [_____________________________]         │   │
│ │   [✓] Use regex patterns                           │   │
│ │                                                     │   │
│ │ Date Range:                                         │   │
│ │   From: [____/____/____]  To: [____/____/____]    │   │
│ │                                                     │   │
│ │ Channel Limits:                                     │   │
│ │   Max videos per channel: [___]                    │   │
│ │                                                     │   │
│ │ Quality:                                            │   │
│ │   [ ] Only HD (720p+)                              │   │
│ │   [ ] Only Full HD (1080p+)                        │   │
│ └────────────────────────────────────────────────────┘   │
```

---

### 4. Debug/Admin Dashboard

**Separate Page:**

```
┌─ Debug & Administration ──────────────────────────────────┐
│                                                            │
│ EXECUTION HISTORY                                          │
│ Last 10 Executions:                                        │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 2024-01-24 14:30:15 | Success | 23 videos added    │   │
│ │ 2024-01-24 08:30:12 | Success | 15 videos added    │   │
│ │ 2024-01-24 02:30:09 | Error   | Quota exceeded     │   │
│ │ ... [View Full Log]                                 │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ API QUOTA STATUS                                           │
│ Daily Quota: ████████░░ 8,234 / 10,000 units used         │
│ Resets in: 9 hours 23 minutes                              │
│                                                            │
│ STATISTICS                                                 │
│ Total Playlists: 12                                        │
│ Total Videos Added (all time): 1,847                       │
│ Success Rate (30 days): 98.5%                              │
│ Average Execution Time: 45 seconds                         │
│                                                            │
│ ACTIONS                                                    │
│ [🔄 Re-authorize OAuth] [🧪 Dry Run Mode] [📤 Export Data]│
│                                                            │
│ ERROR LOG                                                  │
│ [View errors from last 7 days]                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

### 5. Mobile Responsiveness Requirements

**Must Support:**
- Smartphones (320px - 768px width)
- Tablets (768px - 1024px width)
- Desktop (1024px+ width)

**Responsive Behaviors:**
- Stack cards vertically on mobile
- Collapse sidebar navigation to hamburger menu
- Touch-friendly buttons (min 44px tap target)
- Simplified forms on small screens
- Progressive disclosure even more important on mobile

---

### 6. Accessibility Requirements

**WCAG 2.1 Level AA Compliance:**
- Keyboard navigation for all functions
- Screen reader support with ARIA labels
- Sufficient color contrast (4.5:1 minimum)
- Focus indicators on interactive elements
- Error messages associated with form fields
- Skip navigation links
- Resizable text without breaking layout

---

### 7. Authentication & Authorization

**Current State:**
- OAuth through Google Apps Script
- Requires YouTube Data API scope
- Spreadsheet access scope

**Web App Requirements:**
- Same OAuth flow
- Session management
- "Not authorized" state handling
- Clear re-authorization process
- Privacy policy link
- Terms of service

---

### 8. Performance Considerations

**Loading States:**
- Show spinner during API operations
- Indicate which playlist is being updated
- Progress bar for bulk operations
- Don't block UI during background operations

**Caching:**
- Cache playlist info client-side
- Refresh on user action or periodically
- Show stale data with indicator while refreshing

**Optimization:**
- Lazy load playlist details
- Paginate long lists
- Defer loading of advanced features until accessed

---

### 9. Error Handling & User Feedback

**Error Display:**
- Toast notifications for temporary messages
- Inline validation errors on forms
- Dedicated error view for critical failures
- Clear, actionable error messages
- Help links for common errors

**Success Feedback:**
- Confirmation messages for all destructive actions
- Success toasts for completed operations
- Updated UI state to reflect changes
- "Undo" option where applicable

---

### 10. Data Migration from Sheet to Web App

**Challenge:** Users currently configure in Google Sheet.

**Strategy:**
1. **Phase 1:** Web app reads from existing sheet structure
2. **Phase 2:** Web app can write back to sheet (maintains compatibility)
3. **Phase 3:** Option to use web app's own storage (Apps Script Properties or Firebase)
4. **Phase 4:** Deprecate sheet interface (optional)

**Benefits:**
- Gradual migration path
- No forced breaking changes
- Users can choose interface
- Sheet remains as backup/advanced tool

---

### 11. Documentation Integration

**In-App Help:**
- Tooltips on form fields
- Contextual help links
- FAQ section
- Video tutorials (embedded or linked)
- Sample configurations

**External Documentation:**
- Comprehensive web docs
- API reference
- Troubleshooting guide
- Community forum links

---

### 12. Future Extensibility

**Plugin Architecture (Future):**
- Custom filter functions
- Third-party integrations
- Community-contributed features
- API for programmatic access

**Settings Import/Export:**
- JSON format for configurations
- Share configurations between users
- Version control for configurations
- Templates marketplace (future)

---

## Design Principles Summary

### 1. **Simplicity First**
Default view should be usable by non-technical users with minimal explanation.

### 2. **Progressive Disclosure**
Advanced features hidden until needed, revealed through clear navigation.

### 3. **Fail Gracefully**
Errors don't break entire system, clear recovery paths provided.

### 4. **Preserve User Intent**
Safeguards against accidental data loss, confirmations for destructive actions.

### 5. **Performance Matters**
Respect API quotas, optimize for speed, provide feedback during long operations.

### 6. **Accessible to All**
Follow WCAG guidelines, support keyboard navigation, work on all devices.

### 7. **Backwards Compatible**
Maintain support for existing Google Sheet configurations during transition.

### 8. **Community-Driven**
Address real user pain points from GitHub issues, gather ongoing feedback.

---

## Implementation Priorities

### Phase 1: MVP Web App (Weeks 1-4)
**Goal:** Replace basic Google Sheet functionality with web interface.

**Features:**
- User authentication
- Playlist list view
- Basic playlist settings (ID, sources, frequency, delete days)
- Manual update trigger
- View playlist link
- Simple error display

**Success Criteria:**
- Users can perform all Tier 1 functions
- Read/write to existing Google Sheet structure
- No loss of existing functionality

---

### Phase 2: Common Features (Weeks 5-8)
**Goal:** Add most-requested filters and convenience features.

**Features:**
- Shorts filter (if not already working)
- Basic title include/exclude
- Upcoming video filter
- Member-only filter (if API supports)
- Live stream filter
- Debug log viewer

**Success Criteria:**
- Addresses issues #132, #138, partial #123
- Tier 2 features implemented
- User satisfaction with filtering

---

### Phase 3: Advanced Features (Weeks 9-12)
**Goal:** Power user functionality and admin tools.

**Features:**
- Duration filters
- Regex title patterns
- Tag filters
- Date range selection
- Per-channel video limits
- Quality filters (if feasible)
- Statistics dashboard
- Dry run mode

**Success Criteria:**
- Addresses issues #123, #76, #129
- Tier 3 features complete
- Advanced users can fully customize

---

### Phase 4: Polish & Optimization (Weeks 13-16)
**Goal:** Production-ready, scalable, maintainable.

**Features:**
- Mobile optimization
- Accessibility audit and fixes
- Performance optimization
- Comprehensive documentation
- Error handling improvements
- Quota management features
- Notification system (optional)

**Success Criteria:**
- WCAG AA compliant
- Fast on all devices
- < 5% error rate in production
- Positive user feedback

---

### Phase 5: Advanced Workflows (Future)
**Goal:** Features for complex use cases.

**Features:**
- Playlist templates
- Channel groups
- Bulk configuration tools
- Configuration import/export
- Change history/undo
- Video metadata enrichment

**Success Criteria:**
- Large-scale users satisfied
- Community adoption
- Reduced support burden

---

## Technical Architecture Recommendations

### Frontend
- **Framework:** React or Vue.js (component-based, good for progressive disclosure)
- **Styling:** Tailwind CSS or Material-UI (responsive, accessible)
- **State Management:** Context API or Vuex
- **Build Tool:** Vite (fast, modern)

### Backend
- **Platform:** Google Apps Script (maintain existing infrastructure)
- **Web App:** HTML Service with client-side JavaScript
- **API:** Expose Apps Script functions via `google.script.run`
- **Storage:** Continue using Google Sheet as database initially

### Data Flow
```
User Browser
    ↓ (HTTPS)
Google Apps Script Web App
    ↓ (Apps Script API)
Google Sheet (configuration storage)
    ↓ (read/write)
Apps Script Backend (sheetScript.gs logic)
    ↓ (YouTube Data API v3)
YouTube
```

### Alternative Future Architecture
```
User Browser
    ↓ (HTTPS)
Firebase Hosting (web app)
    ↓ (HTTPS API calls)
Google Cloud Functions
    ↓ (Firestore for config)
Firebase Firestore
    ↓ (Cloud Scheduler triggers)
Cloud Functions (execution logic)
    ↓ (YouTube Data API v3)
YouTube
```

**Benefits of Cloud-based:**
- Better performance
- More flexible storage
- Easier to scale
- Modern development workflow

**Drawbacks:**
- Migration complexity
- Cost (Firebase/GCP not free after limits)
- More complex deployment
- Moving away from "just copy a sheet" simplicity

---

## Conclusion

This specification documents **25 current features**, **13 requested enhancements**, **3 critical bugs**, and **12 additional complementary features** for a total of **53 feature items** to consider in the web app redesign.

The proposed 4-tier progressive disclosure UI pattern will allow all features to be supported while maintaining simplicity for basic users. By categorizing features into Core, Common, Advanced, and Admin tiers, the interface can scale gracefully without overwhelming any user segment.

Key design priorities:
1. Maintain backwards compatibility with existing Google Sheet configuration
2. Implement most-requested filters first (Shorts, upcoming, member-only)
3. Create mobile-responsive, accessible interface
4. Provide clear path from simple to advanced usage
5. Preserve existing quota management and error handling
6. Enable future extensibility through modular architecture

This specification should provide sufficient detail for an AI coding agent to create initial interface mockups and implementation plans for the new web application.
