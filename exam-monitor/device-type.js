// Best-effort browser identification, not proof of hardware or student identity.
function deviceType(userAgent,hints={}) {
 const ua=typeof userAgent==='string'?userAgent.slice(0,1024):'';
 const platform=typeof hints?.platform==='string'?hints.platform.slice(0,80):'';
 const touch=typeof hints?.maxTouchPoints==='number'?hints.maxTouchPoints:0;
 if(/iPad/i.test(ua)||(/Mac/i.test(platform)&&touch>1))return 'iPad';
 if(/iPhone/i.test(ua))return 'iPhone';
 if(/Android/i.test(ua))return /Mobile/i.test(ua)?'Android phone':'Android tablet';
 if(/Windows NT/i.test(ua))return 'Computer (Windows)';
 if(/CrOS/i.test(ua))return 'Computer (ChromeOS)';
 if(/Macintosh|Mac OS X/i.test(ua))return 'Computer (Mac)';
 if(/X11|Linux/i.test(ua))return 'Computer (Linux)';
 return 'Unknown device';
}
module.exports={deviceType};
