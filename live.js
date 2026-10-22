(function(){
const LW=LightweightCharts, IV={'15m':900,'1h':3600,'4h':14400}, CB={'15m':900,'1h':3600,'4h':21600};
let tf='1h', venue='Combined', liq=null; const charts={};
function mk(coin){const el=document.getElementById('lc_'+coin);
 const ch=LW.createChart(el,{autoSize:true,layout:{background:{color:'#0d1117'},textColor:'#c9d1d9'},grid:{vertLines:{color:'#161b22'},horzLines:{color:'#161b22'}},timeScale:{timeVisible:true,secondsVisible:false},rightPriceScale:{borderColor:'#30363d'},localization:{timeFormatter:t=>new Date(t*1000).toLocaleString('en-GB',{timeZone:'America/Buenos_Aires',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})}});
 const s=ch.addCandlestickSeries({upColor:'#3fb950',downColor:'#f85149',borderVisible:false,wickUpColor:'#3fb950',wickDownColor:'#f85149'});
 charts[coin]={ch,s,lines:[],src:''};}
async function hl(coin){const n=IV[tf],st=Date.now()-n*1000*400;
 const r=await fetch('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'candleSnapshot',req:{coin,interval:tf,startTime:st}})});
 if(!r.ok)throw 0;const d=await r.json();if(!d.length)throw 0;
 return d.map(k=>({time:k.t/1000,open:+k.o,high:+k.h,low:+k.l,close:+k.c}));}
async function cb(coin){const r=await fetch(`https://api.exchange.coinbase.com/products/${coin}-USD/candles?granularity=${CB[tf]}`);if(!r.ok)throw 0;
 return (await r.json()).map(k=>({time:k[0],low:k[1],high:k[2],open:k[3],close:k[4]})).reverse();}
async function load(coin){const c=charts[coin];let d,src;
 try{d=await hl(coin);src='Hyperliquid perp'}catch(e){try{d=await cb(coin);src='Coinbase spot (fallback'+(tf=='4h'?', 6h candles':'')+')'}catch(e2){document.getElementById('ls_'+coin).textContent='candle feed unavailable';return}}
 c.s.setData(d);const last=d[d.length-1].close;
 document.getElementById('ls_'+coin).textContent=`${src} · ${tf} · last ${last.toLocaleString(undefined,{maximumFractionDigits:2})} · ${new Date().toLocaleTimeString('en-GB',{timeZone:'America/Buenos_Aires'})} ART`;}
function fmt(u){return u>=1e6?'$'+(u/1e6).toFixed(1)+'M':'$'+(u/1e3).toFixed(0)+'k'}
function drawLiq(coin){const c=charts[coin];c.lines.forEach(l=>c.s.removePriceLine(l));c.lines=[];
 if(!liq||!liq.coins[coin])return;const L=liq.coins[coin][venue]||[];if(!L.length)return;
 const top=[...L].sort((a,b)=>b.usd-a.usd).slice(0,Number(document.getElementById('ln').value)),mx=top[0].usd;
 top.forEach(k=>{const f=k.usd/mx,a=(0.35+0.65*f).toFixed(2),col=k.side=='long'?`rgba(248,81,73,${a})`:`rgba(63,185,80,${a})`;
  c.lines.push(c.s.createPriceLine({price:k.px,color:col,lineWidth:Math.max(1,Math.round(f*4)),lineStyle:0,axisLabelVisible:true,title:(k.side=='long'?'L ':'S ')+fmt(k.usd)}));});}
async function loadLiq(){try{liq=await (await fetch('liq_levels.json?t='+Date.now())).json();
 document.getElementById('lmeta').textContent=`Liq levels built ${liq.generated} · positions tracked BTC HL ${liq.coins.BTC.positions.HL}/Lighter ${liq.coins.BTC.positions.Lighter}, ETH HL ${liq.coins.ETH.positions.HL}/Lighter ${liq.coins.ETH.positions.Lighter}`;}catch(e){document.getElementById('lmeta').textContent='liq_levels.json unavailable'}
 ['BTC','ETH'].forEach(drawLiq);}
function all(){['BTC','ETH'].forEach(load)}
['BTC','ETH'].forEach(mk);
document.querySelectorAll('[data-tf]').forEach(b=>b.onclick=()=>{tf=b.dataset.tf;document.querySelectorAll('[data-tf]').forEach(x=>x.classList.toggle('on',x==b));all()});
document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{venue=b.dataset.v;document.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('on',x==b));['BTC','ETH'].forEach(drawLiq)});
document.getElementById('ln').onchange=()=>['BTC','ETH'].forEach(drawLiq);
all();loadLiq();setInterval(all,15000);setInterval(loadLiq,300000);
})();
