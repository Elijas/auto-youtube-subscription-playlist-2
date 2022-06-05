# Scripts to remove videos from YouTube playlists

> Note: the HTML of the YouTube playlist page may change at any moment and possibly render these scripts non-functioning. They are updated periodically, but feel free to create a GitHub issue to prompt one of us to fix them asap.

There are two ways to run these scripts:

1. As a bookmarklet
    - Create a new bookmark and name it how you want to.
    - Copy a script below to the clipboard.
    - Edit your newly created bookmark and paste the script as the URL.
    - Click the bookmark (while on a YouTube playlist page).
2. Via the Console
    - Copy a script below to the clipboard.
    - Open your browser's JavaScript console.
    - Paste the script and press Enter (while on a YouTube playlist page).
  

## Remove all videos:

```js
javascript:(()=>{d=Array.from(document.querySelectorAll("ytd-playlist-video-renderer #interaction"));g=(c=0)=>{if (!d.length)return alert(`Finished removing ${c} videos.`);d.shift().click();requestAnimationFrame(()=>Array.from(document.querySelectorAll("ytd-menu-service-item-renderer")).filter(a=>a.querySelector("yt-formatted-string").innerText.includes("Remove"))[0].click());setTimeout(()=>requestAnimationFrame(()=>g(c+1)),50);};g()})()
```

## Remove all watched videos (thanks to [saso5tr](https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/cy38z0f)):

```js
javascript:(()=>{d=Array.from(document.querySelectorAll("ytd-playlist-video-renderer")).filter((a)=>a.querySelector("ytd-thumbnail-overlay-resume-playback-renderer")!=null).map((a)=>a.querySelector("#interaction"));g=(c=0)=>{if (!d.length)return alert(`Finished removing ${c} videos.`);d.shift().click();requestAnimationFrame(()=>Array.from(document.querySelectorAll("ytd-menu-service-item-renderer")).filter(a=>a.querySelector("yt-formatted-string").innerText.includes("Remove"))[0].click());setTimeout(()=>requestAnimationFrame(()=>g(c+1)),50);};g()})()
```

## Remove a specified amount of videos:

Running this script will prompt you to enter a number for the amount of videos to remove, as well as an offset from where to start. Written by [@deepfriedmind](https://github.com/deepfriedmind).

```js
javascript:(()=>{const a=()=>{Array.from(document.querySelectorAll("ytd-playlist-video-renderer #video-title")).forEach((a,b)=>{a.innerText=`#${b+1} - ${a.innerText.replace(/^#\d{1,3} - /,"")}`})},b=(b=0,c=1)=>{c--;const d=Array.from(document.querySelectorAll("ytd-playlist-video-renderer #interaction")).slice(c,b+c);let e,f;const g=()=>{if(0===d.length)return cancelAnimationFrame(e),cancelAnimationFrame(f),setTimeout(()=>alert(`Finished removing ${b} videos.`),1),setTimeout(a,1);d.shift().click();e=requestAnimationFrame(()=>{for(const a of document.querySelectorAll("ytd-menu-service-item-renderer"))if(a.querySelector("yt-formatted-string").innerText.includes("Remove"))return a.click()}),f=requestAnimationFrame(g)};g()},c=(a=null)=>null!==a&&(isNaN(a)?(alert(`"${a}" is not a number.`),!1):1>parseInt(a,10)?(alert("Must be a positive number."),!1):parseInt(a,10));a(),setTimeout(()=>{let a=prompt("How many videos should be removed? (descending)");if(a=c(a),a){let d=prompt(`Remove ${a} videos starting with #…`,1);d=c(d),d&&b(a,d)}},1)})();
```

## Remove videos based on a keyword/regex:

Running this script will prompt you to enter a keyword or regex pattern for videos to remove. The query is case sensitive unless `/pattern/i` is used. All found matches will be listed in the console for confirmation before removing. Written by [@deepfriedmind](https://github.com/deepfriedmind).

```JS
javascript:(()=>{let a;const b=(a=!1)=>{if(!a)return!1;const b=a.split("/");let c=a,d="";1<b.length&&(c=b[1],d=b[2]);try{return new RegExp(c,d)}catch(a){return!1}},c=(b=!1)=>{if(!b)return alert(`"${a}" is not a valid regex pattern.`),d();let c,e;const f=()=>{if(0===g.length)return cancelAnimationFrame(c),cancelAnimationFrame(e),setTimeout(()=>alert(`Finished removing ${h} videos.`),1);g.shift().click();c=requestAnimationFrame(()=>{for(const a of document.querySelectorAll("ytd-menu-service-item-renderer"))if(a.querySelector("yt-formatted-string").innerText.includes("Remove"))return a.click()}),e=requestAnimationFrame(f)};let g=Array.from(document.querySelectorAll("ytd-playlist-video-renderer")).filter(a=>b.test(a.querySelector("#video-title").innerText));const h=g.length;if(0===h)return alert(`Found no videos matching "${a}".`),d();const i=[];g=g.map((a,b)=>{const c=a.querySelector("#video-title").innerText,d=(b+1).toString().padStart(h.toString().length,"0");return i.push(`${d}: ${c}`),a.querySelector("#interaction")});const j=i.reduce((c,a)=>c.length>a.length?c:a),k=" Titles matched ",l="\u2500".repeat(j.length),m="\u2500".repeat(j.length/2-k.length/2+1);console.log(`\n\n${m}${k}${m}\n\n`);for(const a of i)a.replace(b,(b,c)=>{console.log(`%c${a.substring(0,c)}%c${b}%c${a.substring(c+b.length)}`,"color:#a7b3be","color:#98c379","color:#a7b3be")});console.log(`\n${l}`);const n=`Delete ${h} matching ${1===h?"video":"videos"}? (see console output for exact matches):\n\n${i.join("\n")}`;confirm(n)?f():d()},d=()=>{a=prompt("Enter keyword/regex for videos to remove.\n(case sensitive unless \"/pattern/i\" is used)",localStorage.getItem("__yt_regexInput")||""),null!==a&&(localStorage.setItem("__yt_regexInput",a),c(b(a)))};d()})();
```
