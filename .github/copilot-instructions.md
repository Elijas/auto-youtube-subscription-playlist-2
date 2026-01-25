# GitHub Copilot Instructions

## Project Overview
This is a **Google Apps Script** project that automatically adds new YouTube videos to playlists as a replacement for YouTube's deprecated Collections feature. The system uses Google Sheets as a user interface, Google Apps Script for execution, and YouTube Data API v3 for operations.

## Architecture

### Core Components
- **[sheetScript.gs](../sheetScript.gs)**: Main script with all business logic (~670 lines)
- **[debug.gs](../debug.gs)**: Standalone debug utilities for testing API calls
- **[index.html](../index.html)**: Web app interface for viewing playlists
- **Google Sheet**: User-facing configuration interface (not in repo, deployed separately)

### Execution Model
The script runs as:
1. **Triggered function** via Google Sheets menu item (`YouTube Controls > Update Playlists`)
2. **Time-driven trigger** (hourly schedule configured in Apps Script dashboard)
3. **Web app** deployed via Apps Script (`doGet()` handler)

### Data Flow
```
Google Sheet (config) → updatePlaylists() → YouTube API queries → addVideosToPlaylist() → Update Sheet timestamps
```

## Google Apps Script Specifics

### Critical Platform Constraints
- **YouTube API quota**: Default 10,000 units/day. `maxVideos = 200` limit prevents quota overflow
- **Execution time limit**: 6 minutes for time-driven triggers, 30 minutes for manual runs
- **No Node.js modules**: Pure JavaScript ES5 with Google Services only
- **Services required**: YouTube Data API v3 must be enabled in Apps Script project

### Deployment Pattern
- Users copy a master Google Sheet which contains the bound script
- Script is updated by copying `sheetScript.gs` contents to Apps Script editor

### Global Objects Available
- `YouTube.*` - YouTube Data API v3 service (e.g., `YouTube.Search.list()`, `YouTube.PlaylistItems.insert()`)
- `SpreadsheetApp` - Access to spreadsheet data
- `PropertiesService` - Persistent storage for script properties
- `HtmlService` - Web app template rendering
- `Logger` - Execution logging (accessed via `Logger.log()` and `Logger.getLog()`)

## Code Patterns & Conventions

### Sheet Structure (Zero-Based Indexing)
```javascript
// Reserved indices defined at top of sheetScript.gs
reservedTableRows = 3          // Data starts at row 3 (0-indexed)
reservedTableColumns = 5       // Channel IDs start at column F
reservedColumnPlaylist = 0     // Column A: Playlist ID
reservedColumnTimestamp = 1    // Column B: Last update timestamp (ISO 8601)
reservedColumnFrequency = 2    // Column C: Hours between updates
reservedColumnDeleteDays = 3   // Column D: Days before video deletion
```

**Important**: Sheet coordinates use 1-based indexing in `getRange()` calls: `sheet.getRange(iRow + 1, reservedColumnTimestamp + 1)`

### Error Handling Pattern
```javascript
// Errors are logged but don't stop execution for other playlists
errorflag = false;        // Row-level error tracking
plErrorCount = 0;         // Playlist error counter
totalErrorCount = 0;      // Script-wide error counter

function addError(s) {
  Logger.log(s);
  errorflag = true;       // Prevents timestamp update
  plErrorCount += 1;
}
```

### YouTube API Call Pattern
Always wrap API calls in try-catch and validate response structure:
```javascript
try {
  var results = YouTube.Search.list('id', {
    channelId: channelId,
    maxResults: 50,
    publishedAfter: lastTimestamp
  });
  if (!results || !results.items) {
    addError("Invalid response");
    return [];
  }
} catch (e) {
  addError("Message: [" + e.message + "] Details: " + JSON.stringify(e.details));
  return [];
}
```

### Quota Optimization
- `getVideoIds()`: Uses `YouTube.Search.list()` (100 units) - faster but quota-intensive
- `getVideoIdsWithLessQueries()`: Uses channel uploads playlist (3 units) - slower but quota-efficient
- Current implementation prefers quota efficiency

### Timestamp Format
All timestamps use custom `.toIsoString()` prototype extension (lines 36-50) that includes timezone offset, required by YouTube API's `publishedAfter` parameter.

## Special Behaviors

### First Run
On first execution, timestamps are set to 24 hours ago (`date.setHours(date.getHours() - 24)`) to prevent adding all historical videos.

### Channel ID Handling
- `"ALL"` keyword → fetch all subscribed channels via `YouTube.Subscriptions.list()`
- `"UC..."` → treated as channel ID
- `"PL..."` → treated as playlist ID to mirror
- Other strings → treated as username, resolved via `YouTube.Channels.list({forUsername: ...})`

### Debug System
- Logs written to hidden `DebugData` sheet in columnar format
- `reservedDebugNumRows = 900` rows per column before cycling to next
- Debug viewer (`Debug` sheet) shows last N executions via formula references
- Access logs programmatically: `getLogs(timestamp)`

## Common Development Tasks

### Testing Changes
1. Use [debug.gs](../debug.gs) for isolated API testing (copy to standalone script)
2. Set debug flags at top of `sheetScript.gs`:
   ```javascript
   debugFlag_dontUpdateTimestamp = true;   // Prevent timestamp changes
   debugFlag_dontUpdatePlaylists = true;   // Dry run mode
   debugFlag_logWhenNoNewVideosFound = true; // Verbose logging
   ```

### Adding New Features
- Row-level data: Add new `reservedColumn*` constant and update sheet template
- Video filtering: Modify `getVideoIdsWithLessQueries()` filter predicate (line 336)
- Playlist operations: Extend `addVideosToPlaylist()` or `deletePlaylistItems()`

### Error Investigation
Check `Debug` sheet in Google Sheet for execution logs. Common error codes:
- `404`: Video/channel not found (often private videos, errors suppressed)
- `409`: Video already in playlist (errors suppressed)
- `400` with `playlistOperationUnsupported`: Cannot modify Watch Later/History playlists

## Web App Deployment
- Entry point: `doGet(e)` function
- URL parameters:
  - `?update=True`: Force update all playlists before showing
  - `?pl=N`: Show Nth playlist (1-indexed for users)
- Uses HTML templating: `HtmlService.createTemplateFromFile('index.html')`

## Dependencies & Setup
- No npm/package.json - this is pure Google Apps Script
- Requires YouTube Data API v3 enabled in GCP project linked to Apps Script
- Users must authorize OAuth scopes on first run (YouTube, Spreadsheet access)

## Gotchas
- **No custom URLs**: YouTube custom URLs (`youtube.com/c/username`) cannot be used, must extract channel ID from video → channel URL
- **Recursive function pattern**: `addVideosToPlaylist()` uses recursion for sequential API calls (line 460)
- **Sheet validation**: All functions check `sheet.getRange("A3").getValue() !== "Playlist ID"` to ensure correct sheet
- **Property persistence**: `sheetID` stored via `PropertiesService` to access sheet from time-driven triggers
