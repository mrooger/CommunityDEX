const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('MAIN WebSocket bridge monitors received packets without changing their contents',()=>{
 const sent=[];
 class FakeSocket {
   constructor(url){this.url=url;this.listeners=new Map();this.readyState=1;}
   addEventListener(name,handler){const entries=this.listeners.get(name)||[];entries.push(handler);this.listeners.set(name,entries);}
   emit(name,data){const event={data,target:this};for(const cb of this.listeners.get(name)||[])cb(event);}
 }
 const page={WebSocket:FakeSocket,postMessage(message,origin){sent.push({message,origin});}};
 const environment={window:page,location:{origin:'https://poke.idleworld.online'},WeakSet,Proxy,Reflect,JSON,Date,TextDecoder,ArrayBuffer,Object,String,console};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../main-bridge.js'),'utf-8'),environment);
 const gameSocket=new page.WebSocket('wss://poke.idleworld.online/ws');
 let gameCalled=false;gameSocket.addEventListener('message',()=>{gameCalled=true;});
 gameSocket.emit('message',JSON.stringify({type:'catch-result',speciesName:'Pikachu',success:true}));
 assert.equal(gameCalled,true);
 assert.equal(sent.filter(x=>x.message.type==='packet').length,1);
 assert.equal(sent.find(x=>x.message.type==='packet').message.payload.data.speciesName,'Pikachu');
 assert.equal(sent.find(x=>x.message.type==='packet').origin,'https://poke.idleworld.online');
 gameSocket.emit('message',JSON.stringify({type:'tokens',refreshToken:'sensitive'}));
 assert.equal(sent.filter(x=>x.message.type==='packet').length,1);
});
