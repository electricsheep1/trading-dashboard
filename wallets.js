(function(){
const HLU='https://api.hyperliquid.xyz/info',LTU='https://mainnet.zklighter.elliot.ai/api/v1',$=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=a=>a.length>14?a.slice(0,6)+'…'+a.slice(-4):a;
const usd=v=>v==null||isNaN(v)?'–':(Math.abs(v)>=1e6?'$'+(v/1e6).toFixed(2)+'M':Math.abs(v)>=1e3?'$'+(v/1e3).toFixed(1)+'k':'$'+Number(v).toFixed(0));
const num=v=>v==null||isNaN(v)?'–':Number(v).toLocaleString(undefined,{maximumFractionDigits:v>=100?1:4});
const art=t=>new Date(t).toLocaleString('en-GB',{timeZone:'America/Buenos_Aires',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const link=(v,a)=>v=='HL'?`https://app.hyperliquid.xyz/explorer/address/${a}`:`https://app.lighter.xyz/explorer/accounts/${a}`;
let seed=[],W=[],fills=new Map(),pos={},ltIdx={};
function local(){try{return JSON.parse(localStorage.getItem('wl')||'[]')}catch(e){return[]}}
function saveLocal(l){localStorage.setItem('wl',JSON.stringify(l))}
function merge(){const m=new Map();[...seed,...local()].forEach(w=>{const k=w.venue+':'+w.addr.toLowerCase();if(!m.has(k))m.set(k,w)});W=[...m.values()];
 const s=$('wf_w'),cur=s.value;s.innerHTML='<option value="">All wallets</option>'+W.map(w=>`<option value="${esc(w.venue+':'+w.addr.toLowerCase())}">${esc(w.label)} (${w.venue})</option>`).join('');s.value=cur;
 $('wl_list').innerHTML=W.map(w=>`<span class=chip>${esc(w.label)} · ${w.venue} · <a href="${link(w.venue,w.addr)}" target=_blank>${esc(short(w.addr))}</a>${w.local?` <button data-rm="${esc(w.venue+':'+w.addr)}">×</button>`:''}</span>`).join(' ');
 document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{saveLocal(local().filter(w=>w.venue+':'+w.addr!=b.dataset.rm));merge();render()});}
window.watchAdd=function(venue,addr,label){const l=local();if(!l.some(w=>w.venue==venue&&w.addr.toLowerCase()==addr.toLowerCase())){l.push({venue,addr,label:label||short(addr),local:true});saveLocal(l)}merge();pollAll();};
async function post(b){const r=await fetch(HLU,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok)throw r.status;return r.json()}
async function lget(p){const r=await fetch(LTU+p);if(!r.ok)throw r.status;return r.json()}
async function hlPoll(w){const k='HL:'+w.addr.toLowerCase();
 const f=await post({type:'userFills',user:w.addr});
 f.slice(0,300).forEach(x=>{const n=+x.px*+x.sz;fills.set('HL'+x.tid+x.hash,{t:x.time,wk:k,label:w.label,venue:'HL',addr:w.addr,coin:x.coin,dir:x.dir,size:+x.sz,px:+x.px,usd:n,pnl:+x.closedPnl||0})});}
async function hlPos(w){const k='HL:'+w.addr.toLowerCase(),s=await post({type:'clearinghouseState',user:w.addr});
 pos[k]={w,av:+s.marginSummary.accountValue,rows:s.assetPositions.map(a=>a.position).map(p=>({coin:p.coin,side:+p.szi>0?'long':'short',size:Math.abs(+p.szi),entry:+p.entryPx,usd:+p.positionValue,upnl:+p.unrealizedPnl,lev:p.leverage&&p.leverage.value,liq:p.liquidationPx?+p.liquidationPx:null}))};}
async function ltResolve(w){if(/^\d+$/.test(w.addr))return +w.addr;if(ltIdx[w.addr])return ltIdx[w.addr];
 const d=await lget(`/account?by=l1_address&value=${w.addr}`);return ltIdx[w.addr]=d.accounts[0].index;}
async function ltPoll(w){const k='Lighter:'+w.addr.toLowerCase(),idx=await ltResolve(w);
 const d=await lget(`/trades?sort_by=timestamp&limit=100&account_index=${idx}`);
 (d.trades||[]).forEach(t=>{const bid=t.bid_account_id==idx,takerIsBid=t.is_maker_ask,me_taker=bid==takerIsBid;
  const before=+(me_taker?t.taker_position_size_before:t.maker_position_size_before)||0,flip=me_taker?t.taker_position_sign_changed:t.maker_position_sign_changed,sz=+t.size;
  let dir;if(before==0)dir=bid?'Open Long':'Open Short';else if(before>0)dir=bid?'Open Long':(sz>before+1e-12?'Long > Short':'Close Long');else dir=!bid?'Open Short':(sz>-before+1e-12?'Short > Long':'Close Short');
  fills.set('LT'+t.trade_id,{t:t.timestamp,wk:k,label:w.label,venue:'Lighter',addr:w.addr,coin:t.market_symbol,dir,size:sz,px:+t.price,usd:+t.usd_amount,pnl:+(bid?t.bid_account_pnl:t.ask_account_pnl)||0})});
 const a=(await lget(`/account?by=index&value=${idx}`)).accounts[0];
 pos[k]={w,av:+a.collateral,rows:(a.positions||[]).filter(p=>+p.position!=0).map(p=>({coin:p.symbol,side:p.sign>0?'long':'short',size:+p.position,entry:+p.avg_entry_price,usd:Math.abs(+p.position_value),upnl:+p.unrealized_pnl,lev:p.initial_margin_fraction?(100/ +p.initial_margin_fraction).toFixed(0):null,liq:+p.liquidation_price||null}))};}
let tick=0;
async function pollAll(){tick++;const jobs=[];
 W.forEach(w=>{if(w.venue=='HL'){jobs.push(hlPoll(w));if(tick%3==1)jobs.push(hlPos(w))}else jobs.push(ltPoll(w))});
 const r=await Promise.allSettled(jobs),bad=r.filter(x=>x.status=='rejected').length;
 $('wf_status').textContent=`Live · polled ${new Date().toLocaleTimeString('en-GB',{timeZone:'America/Buenos_Aires'})} ART · ${W.length} wallets${bad?` · ${bad} request(s) failed`:''}`;render();}
function render(){const fw=$('wf_w').value,fc=$('wf_c').value.trim().toUpperCase(),mn=+$('wf_min').value||0,big=+$('wf_big').value||Infinity;
 let L=[...fills.values()].filter(f=>(!fw||f.wk==fw)&&(!fc||f.coin.toUpperCase().includes(fc))&&f.usd>=mn).sort((a,b)=>b.t-a.t).slice(0,300);
 $('wf_feed').innerHTML='<tr><th>Time ART</th><th>Wallet</th><th>Venue</th><th>Coin</th><th>Dir</th><th>Size</th><th>USD</th><th>Price</th><th>Closed PnL</th></tr>'+L.map(f=>`<tr class="${f.usd>=big?'big':''}"><td>${art(f.t)}</td><td><a href="${link(f.venue,f.addr)}" target=_blank>${esc(f.label)}</a></td><td>${f.venue}</td><td>${esc(f.coin)}</td><td class="${/Long|Buy/.test(f.dir)&&!/Close Long|> Short/.test(f.dir)?'long':'short'}">${esc(f.dir)}</td><td>${num(f.size)}</td><td>${usd(f.usd)}</td><td>${num(f.px)}</td><td class="${f.pnl>0?'long':f.pnl<0?'short':''}">${f.pnl?usd(f.pnl):''}</td></tr>`).join('');
 $('wf_pos').innerHTML=Object.values(pos).filter(p=>W.some(w=>w.venue+':'+w.addr.toLowerCase()==p.w.venue+':'+p.w.addr.toLowerCase())).map(p=>`<div class=card><b>${esc(p.w.label)}</b> <span class=meta>${p.w.venue} · <a href="${link(p.w.venue,p.w.addr)}" target=_blank>${esc(short(p.w.addr))}</a> · equity ${usd(p.av)}</span>${p.rows.length?'<div class=tw><table><tr><th>Coin</th><th>Side</th><th>Size</th><th>USD</th><th>Entry</th><th>uPnL</th><th>Lev</th><th>Liq</th></tr>'+p.rows.sort((a,b)=>b.usd-a.usd).map(r=>`<tr><td>${esc(r.coin)}</td><td class=${r.side}>${r.side}</td><td>${num(r.size)}</td><td>${usd(r.usd)}</td><td>${num(r.entry)}</td><td class="${r.upnl>=0?'long':'short'}">${usd(r.upnl)}</td><td>${r.lev?r.lev+'×':'–'}</td><td>${num(r.liq)}</td></tr>`).join('')+'</table></div>':'<p class=meta>No open positions</p>'}</div>`).join('');}
// whales
let WH=null;
async function loadWhales(){try{WH=await (await fetch('whales.json?t='+Date.now())).json()}catch(e){$('wh_meta').textContent='whales.json unavailable';return}drawWhales()}
function drawWhales(){if(!WH)return;const c=$('wh_c').value,v=$('wh_v').value,d=WH.coins[c][v],mark=WH.coins[c].mark;
 $('wh_meta').textContent=`Built ${WH.generated} · mark ${num(mark)} · top ${d.rows.length} ${c} positions on ${v}`;
 const tot=d.long_usd+d.short_usd||1;$('wh_sum').innerHTML=`<div class=bar><div class=lbar style="width:${(d.long_usd/tot*100).toFixed(1)}%">Long ${usd(d.long_usd)} (${(d.long_usd/tot*100).toFixed(0)}%)</div><div class=sbar>Short ${usd(d.short_usd)}</div></div>`;
 $('wh_t').innerHTML='<tr><th>#</th><th>Account</th><th>Side</th><th>Size</th><th>Notional</th><th>Entry</th><th>uPnL</th><th>Lev</th><th>Liq</th><th>To liq</th><th>Seen</th><th></th></tr>'+d.rows.map((r,i)=>`<tr><td>${i+1}</td><td><a href="${link(v,r.addr)}" target=_blank>${esc(short(r.addr))}</a></td><td class=${r.side}>${r.side}</td><td>${num(r.size)}</td><td>${usd(r.notional)}</td><td>${num(r.entry)}</td><td class="${r.upnl>=0?'long':'short'}">${usd(r.upnl)}</td><td>${r.lev?r.lev+'×':'–'}</td><td>${num(r.liq)}</td><td>${r.dist_liq_pct==null?'–':r.dist_liq_pct+'%'}</td><td>${r.age_min<90?r.age_min+'m':(r.age_min/60).toFixed(0)+'h'} ago</td><td><button data-add="${esc(r.addr)}">+Watch</button></td></tr>`).join('');
 document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{watchAdd(v,b.dataset.add,c+' whale '+short(b.dataset.add));b.textContent='✓';});}
async function init(){try{const s=await (await fetch('watchlist.json?t='+Date.now())).json();seed=[...(s.hyperliquid||[]).map(w=>({...w,venue:'HL'})),...(s.lighter||[]).map(w=>({...w,venue:'Lighter'}))]}catch(e){}
 merge();['wf_w','wf_min','wf_big'].forEach(i=>$(i).onchange=render);$('wf_c').oninput=render;['wh_c','wh_v'].forEach(i=>$(i).onchange=drawWhales);
 $('wf_add').onclick=()=>{const a=$('wf_addr').value.trim();if(!a)return;watchAdd($('wf_ven').value,a,$('wf_lbl').value.trim()||null);$('wf_addr').value='';$('wf_lbl').value=''};
 pollAll();setInterval(pollAll,20000);loadWhales();setInterval(loadWhales,300000);}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('on',x==b));document.querySelectorAll('.tab').forEach(t=>t.style.display=t.id==b.dataset.tab?'':'none');location.hash=b.dataset.tab;});
init();const h=location.hash.slice(1);if(h){const b=document.querySelector(`[data-tab="${h}"]`);b&&b.click()}
})();
