const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('feature dropdown links to distinct branded pages with accurate product and roadmap content',()=>{
const home=fs.readFileSync('public/index.html','utf8');assert.match(home,/class="features-menu"/);
const views=fs.readFileSync('public/features/classroom-views.html','utf8');assert.match(views,/student-step-grid/);assert.match(views,/product-view-row/);const grades=fs.readFileSync('public/features/grading-ai.html','utf8');for(const name of ['creation','library','summary','detailed','downloads'])assert.ok(grades.includes('/landing/product/'+name+'.png'),name);
for(const slug of ['monitoring','classroom-views','grading-ai','games']){const url='/features/'+slug+'.html';assert.ok(home.includes(url));const html=fs.readFileSync('public'+url,'utf8');assert.match(html,/examio-mark.svg/);assert.match(html,/<h1/);assert.match(html,/features-menu/);assert.match(html,/data-language-switch/);}
assert.match(fs.readFileSync('public/features/games.html','utf8'),/Coming soon/);const monitoring=fs.readFileSync('public/features/monitoring.html','utf8');assert.doesNotMatch(monitoring,/Browser-based, with clear limits/);for(const name of ['activity','paused','professor-review','options','call-professor','activity-log'])assert.ok(monitoring.includes('/landing/monitoring/'+name+'.png'),name);
});
