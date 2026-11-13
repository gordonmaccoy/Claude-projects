const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('feature dropdown links to distinct branded pages with accurate product and roadmap content',()=>{
const home=fs.readFileSync('public/index.html','utf8');assert.match(home,/class="features-menu"/);
for(const slug of ['monitoring','classroom-views','grading-ai','games']){const url='/features/'+slug+'.html';assert.ok(home.includes(url));const html=fs.readFileSync('public'+url,'utf8');assert.match(html,/examio-mark.svg/);assert.match(html,/<h1/);assert.match(html,/features-menu/);assert.match(html,/data-language-switch/);}
assert.match(fs.readFileSync('public/features/games.html','utf8'),/Coming soon/);assert.match(fs.readFileSync('public/features/monitoring.html','utf8'),/cannot block screenshots/);
});
