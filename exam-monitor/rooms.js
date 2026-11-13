const {randomInt}=require('node:crypto');
function roomName(value){
 if(typeof value!=='string'||/[\x00-\x1f\x7f]/.test(value))throw new Error('Room name must be 1–50 letters, numbers, spaces or hyphens.');
 const name=value.normalize('NFKC').trim().replace(/\s+/gu,' ');
 if(!name||name.length>50||!/^[\p{L}\p{N} -]+$/u.test(name))throw new Error('Room name must be 1–50 letters, numbers, spaces or hyphens.');
 return {name,key:name.toLowerCase()};
}
function generateRoomName(){const first=['Furry','Orange','Flimsy','Wobbly','Disco','Sleepy','Bouncy','Sneaky','Sparkly','Noodle','Jolly','Dizzy'];const last=['Bazooka','Socks','Pencil','Penguin','Turnip','Rocket','Waffle','Banana','Teapot','Potato','Pickle','Taco'];return roomName(first[randomInt(first.length)]+' '+last[randomInt(last.length)]+' '+randomInt(1000,10000));}
module.exports={roomName,generateRoomName};
