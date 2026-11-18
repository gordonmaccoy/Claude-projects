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
test('history groups typing, restores full drafts, discards redo after a new edit, and resets between games',()=>{
 const history=Editor.history(),draft={title:'Game',theme:'default',questions:[structuredClone(q)]};
 history.record(draft,0);const field={};draft.questions[0].text='First';history.record(draft,0,field,100);draft.questions[0].text='First question';history.record(draft,0,field,200);
 assert.equal(history.undo().draft.questions[0].text,'Capital?');assert.equal(history.redo().draft.questions[0].text,'First question');
 draft.theme='summer';history.record(draft,0);assert.equal(history.undo().draft.theme,'default');
 draft.theme='winter';history.record(draft,0);assert.equal(history.canRedo,false);assert.equal(history.undo().draft.theme,'default');
 history.reset();assert.equal(history.canUndo,false);assert.equal(history.canRedo,false);assert.equal(history.undo(),null);
});
test('history restores a deleted question and selection without aliasing snapshots',()=>{
 const history=Editor.history(),draft={questions:[structuredClone(q),{...structuredClone(q),id:'second'}]};history.record(draft,1);draft.questions.pop();history.record(draft,0);
 const restored=history.undo();assert.equal(restored.selected,1);assert.equal(restored.draft.questions[1].id,'second');restored.draft.questions[1].text='mutated';history.redo();assert.equal(history.undo().draft.questions[1].text,q.text);
});
