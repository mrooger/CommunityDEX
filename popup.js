'use strict';
document.querySelector('#open').addEventListener('click',()=>chrome.tabs.create({url:'https://poke.idleworld.online/play'}));
document.querySelector('#help').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('manual.html')}));
