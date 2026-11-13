const {randomInt}=require('node:crypto');
function roomName(value){
 if(typeof value!=='string'||/[\x00-\x1f\x7f]/.test(value))throw new Error('Room name must be 1–50 letters, numbers, spaces or hyphens.');
 const name=value.normalize('NFKC').trim().replace(/\s+/gu,' ');
 if(!name||name.length>50||!/^[\p{L}\p{N} -]+$/u.test(name))throw new Error('Room name must be 1–50 letters, numbers, spaces or hyphens.');
 return {name,key:name.toLowerCase()};
}
function generateRoomName(){
 const first=['Furry','Orange','Flimsy','Wobbly','Disco','Sleepy','Bouncy','Sneaky','Sparkly','Noodle','Jolly','Dizzy','Silly','Fluffy','Tiny','Mighty','Wiggly','Cosmic','Happy','Purple','Pink','Blue','Green','Yellow','Zippy','Chilly','Fuzzy','Goofy','Lucky','Merry','Wonky','Breezy','Crispy','Curly','Dapper','Doodle','Fancy','Fizzy','Jazzy','Loopy','Lumpy','Nutty','Perky','Plucky','Puffy','Quirky','Soggy','Squeaky','Sunny','Swirly','Toasty','Twisty','Wacky','Woolly','Yummy','Zany','Bubbly','Cheery','Cheeky','Funky','Giggly','Groovy','Peppy','Snazzy'];
 const last=['Bazooka','Socks','Pencil','Penguin','Turnip','Rocket','Waffle','Banana','Teapot','Potato','Pickle','Taco','Muffin','Donut','Nugget','Panda','Otter','Walrus','Llama','Koala','Badger','Beaver','Bunny','Carrot','Cookie','Crayon','Cupcake','Dumpling','Flamingo','Giraffe','Hamster','Hippo','Jelly','Kettle','Kitten','Lemon','Lobster','Mango','Melon','Mochi','Noodle','Pancake','Parrot','Peanut','Pepper','Pizza','Popcorn','Pudding','Pumpkin','Radish','Ravioli','Robot','Salmon','Sausage','Sparrow','Spoon','Squid','Turtle','Wombat','Yak','Zebra','Pretzel','Bagel','Biscuit'];
 return roomName(first[randomInt(first.length)]+' '+last[randomInt(last.length)]);
}
module.exports={roomName,generateRoomName};
