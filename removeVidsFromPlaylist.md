# Scripts to remove videos from playlists

- [Link to remove all items from a youtube playlist:](#link-to-remove-all-items-from-a-youtube-playlist)
    - [Using new YouTube theme](#using-new-youtube-theme)
        - [For Mac](#for-mac)
        - [For Windows](#for-windows)
    - [Using classic YouTube theme](#using-classic-youtube-theme)
- [Link to remove watched items from a youtube playlist (thanks to saso5tr):](#link-to-remove-watched-items-from-a-youtube-playlist-thanks-to-saso5tr)
    - [Using new YouTube theme](#using-new-youtube-theme)
        - [For Mac](#for-mac)
        - [For Windows](#for-windows)
    - [Using classic YouTube theme](#using-classic-youtube-theme)

## Link to remove all items from a youtube playlist:

To remove all playlist items, bookmark the link below and click on it while having the youtube playlist page open. Or, open javascript console, paste the script there and run.

### Using [new](https://www.youtube.com/new) YouTube theme

#### For Mac

```js
javascript:(function(){if(confirm('Remove all?')&&confirm('Are you sure?')){for(c=[].slice.call(document.querySelectorAll('ytd-playlist-video-renderer')),i=c.length;i--;c[i]=c[i].firstElementChild.nextElementSibling.lastElementChild.firstElementChild.lastElementChild);iid=window.setInterval(function(){if(!c[0]){window.clearInterval(iid);return;};c.pop().click();setTimeout(()=>{d=[].slice.call(document.querySelectorAll('ytd-menu-service-item-renderer'));for(i=d.length;i--;d[i].innerText.indexOf("Remove")!=-1?d[i].click():void(0));}, 1);},400);}})();
```

#### For Windows

```js
javascript:(function(){if(confirm('Remove all?')&&confirm('Are you sure?')){for(c=[].slice.call(document.querySelectorAll('ytd-playlist-video-renderer')),i=c.length;i--;c[i]=c[i].lastElementChild.lastElementChild.firstElementChild.lastElementChild.firstElementChild);iid=window.setInterval(function(){if(!c[0]){window.clearInterval(iid);return;};c.pop().click();setTimeout(()=>{d=[].slice.call(document.querySelectorAll('ytd-menu-service-item-renderer'));for(i=d.length;i--;d[i].innerText.indexOf("Remove")!=-1?d[i].click():void(0));},1)},400);}})();
```

### Using [classic](https://www.youtube.com/?disable_polymer=true) YouTube theme 

```js
javascript:(function(){if(confirm('Remove all?')&&confirm('Are you sure?')){let c=[].slice.call(document.querySelectorAll('.pl-video-edit-remove')),iid=window.setInterval(function(){if(!c[0]){window.clearInterval(iid);return;}c.pop().click();},200);}})();
```

([source](https://gist.github.com/timothyarmstrong/10501804))

## Link to remove watched items from a youtube playlist (thanks to [saso5tr](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/cy38z0f)):

Same as above.

### Using new YouTube theme

#### For Mac

```js
javascript:(function(){if(confirm('Remove all watched?')){for(c=[].slice.call(document.querySelectorAll('ytd-thumbnail-overlay-resume-playback-renderer')),i=c.length;i--;c[i]=c[i].parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.firstElementChild.nextElementSibling.lastElementChild.firstElementChild.lastElementChild);iid=window.setInterval(function(){if(!c[0]){window.clearInterval(iid);return;};c.pop().click();setTimeout(()=>{d=[].slice.call(document.querySelectorAll('ytd-menu-service-item-renderer'));d[d.length-4].click()}, 1);},400);}})();
```

#### For Windows

```js
javascript:(function(){if(confirm('Remove all watched?')){for(c=[].slice.call(document.querySelectorAll('ytd-thumbnail-overlay-resume-playback-renderer')),i=c.length;i--;c[i]=c[i].parentElement.parentElement.parentElement.parentElement.parentElement.firstElementChild.nextElementSibling.nextElementSibling.firstElementChild.firstElementChild.nextElementSibling.firstElementChild);iid=window.setInterval(function(){if(!c[0]){window.clearInterval(iid);return;};c.pop().click();setTimeout(()=>{d=[].slice.call(document.querySelectorAll('ytd-menu-service-item-renderer'));d[d.length-4].click()}, 1);},400);}})();
```

### Using classic YouTube theme

```js
javascript:(function(){if(confirm('Remove all watched?')){for(c=[].slice.call(document.querySelectorAll('.resume-playback-background')),i=c.length;i--;c[i]=c[i].parentElement.parentElement.parentElement.querySelector('.pl-video-edit-remove'));iid=window.setInterval(function(){if(!c[0]){window.clearInterval(iid);return;};c.pop().click();},400);}})();
```
