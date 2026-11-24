const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deviceType}=require('../device-type');
test('classifies devices including desktop-mode iPads without misclassifying touch PCs',()=>{
 for(const [ua,hints,expected]of [
 ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',{},'iPad'],
 ['Mozilla/5.0 (Macintosh; Intel Mac OS X)',{platform:'MacIntel',maxTouchPoints:5},'iPad'],
 ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)',{},'iPhone'],
 ['Mozilla/5.0 (Linux; Android 15; Pixel) Mobile Safari',{},'Android phone'],
 ['Mozilla/5.0 (Linux; Android 15; Tablet) Safari',{},'Android tablet'],
 ['Mozilla/5.0 (Windows NT 10.0)',{platform:'Win32',maxTouchPoints:10},'Computer (Windows)'],
 ['Mozilla/5.0 (Macintosh; Intel Mac OS X)',{platform:'MacIntel',maxTouchPoints:0},'Computer (Mac)'],
 ['Mozilla/5.0 (X11; CrOS x86_64)',{},'Computer (ChromeOS)'],
 ['Mozilla/5.0 (X11; Linux x86_64)',{},'Computer (Linux)'],
 [null,null,'Unknown device'],['',{},'Unknown device']
 ])assert.equal(deviceType(ua,hints),expected);
});
