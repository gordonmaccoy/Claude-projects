const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const publicFile=name=>fs.readFileSync(new URL('../public/'+name,'file://'+__filename),'utf8');
const declarations=(css,selector)=>{
 const rule=css.slice(css.indexOf(selector+'{')+selector.length+1).split('}')[0];
 return Object.fromEntries(rule.split(';').map(v=>v.split(':').map(s=>s.trim())).filter(pair=>pair.length===2));
};
test('quiz classroom puts the theme and live-activity switch in one header control row',()=>{
 const html=publicFile('classroom.html');
 const controls=html.match(/<div class="class-header-controls">([\s\S]*?)<\/div>/)?.[1];
 assert.ok(controls);
 assert.match(controls,/id="class-theme-toggle"/);
 assert.match(controls,/<input id="class-live-activity" type="checkbox" role="switch" checked>/);
 assert.match(controls,/Show live activity/);
 assert.equal((html.match(/id="class-live-activity"/g)||[]).length,1);
 assert.match(html,/classroom\.css\?v=compact-class-header/);
});
test('quiz lobby header and unexpanded QR use the Game classroom dimensions',()=>{
 const quiz=publicFile('classroom.css'),game=publicFile('game-classroom-lobby.css');
 for(const key of ['grid-template-columns','gap','padding'])assert.equal(
  declarations(quiz,'.class-display-header')[key],declarations(game,'.game-display.game-projector-lobby>header')[key],key
 );
 for(const key of ['padding','gap'])assert.equal(
  declarations(quiz,'.class-display-header #qr-toggle:not(.expanded)')[key],declarations(game,'.game-display .game-room-qr')[key],key
 );
 assert.equal(declarations(quiz,'.class-display-header #qr-toggle:not(.expanded) #qr')['inline-size'],declarations(game,'.game-room-qr img')['inline-size']);
 assert.match(quiz,/#qr-toggle\.expanded #qr\{width:min\(72vh,80vw\);height:min\(72vh,80vw\)/);
 assert.match(quiz,/@media\(max-width:710px\)\{[\s\S]*?\.class-room-banner\{grid-column:1\/-1;grid-row:2\}/);
});
