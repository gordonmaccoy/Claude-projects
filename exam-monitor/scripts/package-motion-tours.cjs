const fs=require('node:fs'),path=require('node:path'),tours=require('./motion-tours/scenes.json');
const dest=path.resolve('public/tour/videos');fs.mkdirSync(dest,{recursive:true});
const labels={launch:'Launch quiz',monitoring:'Monitoring',create:'Create quiz',results:'Results',games:'Games'};
const catalog=tours.map(t=>{const source=path.resolve('output/motion-tours/landscape');for(const [from,to]of [[t.id+'.mp4',t.id+'.mp4'],[t.id+'-1.jpg',t.id+'.jpg']]){const src=path.join(source,from);if(!fs.existsSync(src))throw Error('Missing final media: '+src);fs.copyFileSync(src,path.join(dest,to));}return {id:t.id,label:labels[t.id],title:t.title,src:'/tour/videos/'+t.id+'.mp4',poster:'/tour/videos/'+t.id+'.jpg',steps:t.scenes.map(s=>s[1])};});
fs.writeFileSync('public/tour/videos.js','window.examioVideoTours='+JSON.stringify(catalog,null,2)+';\n');console.log('Packaged',catalog.length,'video tours');
