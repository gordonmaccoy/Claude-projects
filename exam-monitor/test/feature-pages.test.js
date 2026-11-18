const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('feature dropdown links to distinct branded pages with accurate product content',()=>{
const home=fs.readFileSync('public/index.html','utf8');assert.match(home,/class="features-menu"/);
const views=fs.readFileSync('public/features/classroom-views.html','utf8');assert.match(views,/student-step-grid/);assert.match(views,/product-view-row/);const grades=fs.readFileSync('public/features/grading-ai.html','utf8');for(const name of ['creation','library','summary','detailed'])assert.ok(grades.includes('/landing/product/'+name+'.png'),name);
assert.match(views,/id="preview-carousel"/);for(const asset of ['summary-pdf.jpg','detailed-excel.png'])assert.ok(grades.includes(asset));
for(const slug of ['monitoring','classroom-views','grading-ai','games']){const url='/features/'+slug+'.html';assert.ok(home.includes(url));const html=fs.readFileSync('public'+url,'utf8');assert.match(html,/examio-mark.svg/);assert.match(html,/<h1/);assert.match(html,/features-menu/);assert.match(html,/data-language-switch/);}
const games=fs.readFileSync('public/features/games.html','utf8');
assert.match(games,/href="\/professor.html\?tab=games">Open Game Library/);
assert.match(games,/Game Mode does not create grades/);
assert.doesNotMatch(games,/Coming soon|launch date|not available yet/i);
assert.match(fs.readFileSync('public/professor.html','utf8'),/data-tab="games"[^>]*aria-label="Game Library"/);
assert.match(home,/Join a test or game/);
const monitoring=fs.readFileSync('public/features/monitoring.html','utf8');assert.doesNotMatch(monitoring,/Browser-based, with clear limits/);
});

test('Monitoring shows three visual examples and one combined professor decision card',()=>{
 const page=fs.readFileSync('public/features/monitoring.html','utf8');
 const row=page.split('class="fp-cards monitor-overview"')[1].split('</section>')[0];
 assert.equal((row.match(/<article[ >]/g)||[]).length,3);
 for(const name of ['class-display-20.png','phone-paused.svg','phone-call-professor.svg']){
  assert.ok(row.includes('/landing/monitoring/'+name),name);
  assert.ok(fs.statSync('public/landing/monitoring/'+name).size>500);
 }
 const decision=page.match(/<article class="monitor-detail monitor-decision">([\s\S]+?)<\/article>/)?.[1]||'';
 assert.match(decision,/Review the activity log and make the final call/);
 assert.match(decision,/unlock the attempt or submit the fail score/i);
 assert.match(decision,/activity-log\.png/);
 assert.equal((page.match(/data-screenshot aria-label=/g)||[]).length,5);
 assert.doesNotMatch(page,/professor-review\.png/);
});

test('marketing and testing headers share the more open Examio wordmark styling',()=>{
 const brand=fs.readFileSync('public/examio.css','utf8'), landing=fs.readFileSync('public/landing.css','utf8');
 assert.match(brand,/--examio-wordmark-weight:\s*700/);
 assert.match(brand,/--examio-wordmark-tracking:\s*-\.02em/);
 assert.match(brand,/--examio-wordmark-size:\s*2\.05rem/);
 for(const css of [brand,landing]){
   assert.match(css,/strong\s*\{[^}]*font-size:\s*var\(--examio-wordmark-size\)/);
   assert.match(css,/strong\s*\{[^}]*font-weight:\s*var\(--examio-wordmark-weight\)/);
   assert.match(css,/strong\s*\{[^}]*letter-spacing:\s*var\(--examio-wordmark-tracking\)/);
   assert.match(css,/strong\s*\{\s*font-size:\s*var\(--examio-wordmark-compact\)/);
 }
});
