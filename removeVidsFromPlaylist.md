# Scripts to remove videos from playlists

Note, the html of the YouTube page is constantly changing, meaning this script will become outdated often. The script is periodically updated, but feel free to add a GitHub issue to prompt one of us update it asap.

## Link to remove all items from a youtube playlist:

To remove all playlist items, bookmark the link below and click on it while having the youtube playlist page open. Or, open javascript console, paste the script there and run.

```js
javascript:(function(){if(confirm('Remove all?')&&confirm('Are you sure?')){for(c=[].slice.call(document.querySelectorAll('ytd-playlist-video-renderer')),i=c.length;i--;c[i]=c[i].lastElementChild.lastElementChild.lastElementChild);iid=window.setInterval(function(){if(!c[0]){window.clearInterval(iid);return;};c.pop().click();setTimeout(()=>{d=[].slice.call(document.querySelectorAll('ytd-menu-service-item-renderer'));for(i=d.length;i--;d[i].innerText.indexOf("Remove")!=-1?d[i].click():void(0));}, 1);},400);}})();
```

## Link to remove watched items from a youtube playlist (thanks to [saso5tr](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/cy38z0f)):

Same as above.

```js
javascript:(function(){if(confirm('Remove all watched?')){for(c=[].slice.call(document.querySelectorAll('ytd-thumbnail-overlay-resume-playback-renderer')),i=c.length;i--;c[i]=c[i].parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.lastElementChild.lastElementChild.lastElementChild);iid=window.setInterval(function(){if(!c[0]){window.clearInterval(iid);return;};c.pop().click();setTimeout(()=>{d=[].slice.call(document.querySelectorAll('ytd-menu-service-item-renderer'));d[d.length-4].click()}, 1);},400);}})();
```
