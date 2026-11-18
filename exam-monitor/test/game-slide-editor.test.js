const assert=require('node:assert/strict');
const test=require('node:test');
const Editor=require('../public/game-slide-editor');
const q={id:'q',text:'Capital?',durationSeconds:20,options:[{id:'a',text:'Seoul'},{id:'b',text:'Paris'}],correctOptionId:'a',image:'example',media:{type:'video',url:'https://example.com/video.mp4'},answerExplanation:'South Korea'};
test('duplicate creates independent IDs and preserves the correct answer and media',()=>{
 const copy=Editor.duplicate(q);assert.notEqual(copy.id,q.id);assert.notEqual(copy.options[0].id,q.options[0].id);assert.equal(copy.correctOptionId,copy.options[0].id);assert.deepEqual(copy.media,q.media);copy.options[0].text='Changed';assert.equal(q.options[0].text,'Seoul');
});
test('validates every question including hidden drafts and media',()=>{
 assert.equal(Editor.validate([q]),null);
 assert.equal(Editor.validate([q,{...q,text:' '}]).index,1);
 assert.match(Editor.validate([{...q,correctOptionId:'missing'}]).message,/correct answer/);
 assert.match(Editor.validate([{...q,durationSeconds:4}]).message,/5.*240/);
 assert.match(Editor.validate([{...q,media:{type:'video',url:'javascript:alert(1)'}}]).message,/HTTPS/);
 assert.match(Editor.validate([{...q,options:[{id:'a',text:''},{id:'b',text:'B'}]}]).message,/answer/);
});
test('media validation matches supported persisted images and YouTube forms',()=>{
 const image='data:image/png;base64,aGVsbG8=';
 assert.equal(Editor.validate([{...q,media:{type:'image',url:image}}]),null);
 for(const url of ['https://youtu.be/abcdefghijk','https://m.youtube.com/watch?v=abcdefghijk','https://www.youtube.com/embed/abcdefghijk'])assert.equal(Editor.validate([{...q,media:{type:'youtube',url}}]),null);
 assert.match(Editor.validate([{...q,media:{type:'youtube',url:'https://example.com/watch?v=abcdefghijk'}}]).message,/YouTube/);
 assert.match(Editor.validate([{...q,media:{type:'video',url:'https://example.com/'+ 'a'.repeat(2050)}}]).message,/HTTPS/);
});
