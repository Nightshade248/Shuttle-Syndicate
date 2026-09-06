const APP_VERSION="V1.4.5";
const KEY="ss_v143_tournament";const OLD_KEY="ss_v142_tournament";
const safeSession=window.sessionStorage||{getItem(){return ""},setItem(){}};
const state={page:"admin",tournament:null,adminDraft:null,generatedLink:"",shared:false,canScore:false,adminKey:safeSession.getItem("ss_v145_admin_key")||"",realtime:{client:null,channel:null,enabled:false,loading:false}};
const SUPABASE_CONFIG=window.SHUTTLE_SUPABASE||{url:"",anonKey:""};
let remoteApplying=false;
async function initRealtimeClient(){if(state.realtime.client||!SUPABASE_CONFIG.url||!SUPABASE_CONFIG.anonKey)return state.realtime.client;try{const mod=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");state.realtime.client=mod.createClient(SUPABASE_CONFIG.url,SUPABASE_CONFIG.anonKey);state.realtime.enabled=true;return state.realtime.client}catch(err){console.warn("Shuttle Syndicate realtime unavailable",err);return null}}
async function publishTournament(t){const client=await initRealtimeClient();if(!client||!t?.id||!state.adminKey)return false;const {data,error}=await client.rpc("upsert_shuttle_tournament",{p_id:t.id,p_admin_key:state.adminKey,p_state:t});if(error){console.warn("Realtime publish failed",error);return false}return !!data}

async function fetchTournament(id){const client=await initRealtimeClient();if(!client)return null;const {data,error}=await client.from("shuttle_tournaments").select("state").eq("id",id).single();if(error){console.warn("Realtime fetch failed",error);return null}return data?.state||null}
async function subscribeTournament(id){const client=await initRealtimeClient();if(!client||!id)return;if(state.realtime.channel)await client.removeChannel(state.realtime.channel);state.realtime.channel=client.channel("shuttle-tournament-"+id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"shuttle_tournaments",filter:"id=eq."+id},payload=>{const incoming=payload.new?.state;if(!incoming)return;remoteApplying=true;state.tournament=incoming;try{localStorage.setItem(KEY,JSON.stringify(incoming))}catch{};render();remoteApplying=false}).subscribe((status,err)=>{if(err)console.warn("Realtime subscription error",status,err)})}
async function connectSharedTournament(id){state.realtime.loading=true;const remote=await fetchTournament(id);if(remote){state.tournament=remote;try{localStorage.setItem(KEY,JSON.stringify(remote))}catch{};await subscribeTournament(id)}state.realtime.loading=false;render()}
function syncTournament(){if(state.tournament&&!remoteApplying)publishTournament(state.tournament)}
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const uid=()=>"SS-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
const num=(v,d=0)=>{const x=Number(v);return Number.isFinite(x)?x:d};
const calcGames=(players,gpp)=>players*gpp/4;
const combinations=(arr,k)=>{const out=[];function rec(start,p){if(p.length===k){out.push(p.slice());return}for(let i=start;i<=arr.length-(k-p.length);i++){p.push(arr[i]);rec(i+1,p);p.pop()}}rec(0,[]);return out};
const pairKey=(a,b)=>[a,b].sort().join("|");
const gameKey=(a,b,c,d)=>{const x=[a,b].sort().join("|");const y=[c,d].sort().join("|");return [x,y].sort().join("::")};
const shuffle=a=>{const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const durationMinutes=h=>Math.max(60,num(h)*60);
function maxUniqueGames(pc,type){if(type==="Team vs Team"){const side=pc/2;return side>=2?((side*(side-1))/2)**2:0}return pc>=4?((pc*(pc-1)*(pc-2)*(pc-3))/24)*3:0}
function validConfig(pc,courts,hours,gpp,type){const total=calcGames(pc,gpp);return Number.isInteger(pc)&&pc>=4&&pc<=18&&Number.isInteger(courts)&&courts>=1&&courts<=3&&num(hours)>0&&Number.isInteger(gpp)&&gpp>=1&&gpp<=12&&(type!=="Team vs Team"||pc%2===0)&&Number.isInteger(total)&&total<=maxUniqueGames(pc,type);}
function pairPenalty(a,b,partner){return partner[a]?.[b]||0}
function gamePenalty(a,b,partner,opponent){let s=0;for(const x of a)for(const y of b)s+=(opponent[x]?.[y]||0)*4;return s+a.reduce((v,x)=>v+pairPenalty(x,a[1-a.indexOf(x)],partner)*30,0)+b.reduce((v,x)=>v+pairPenalty(x,b[1-b.indexOf(x)],partner)*30,0)}
function buildTeamSchedule(ids,target){
 const total=ids.length*target/2,maxPartnerUses=Math.max(1,(ids.length*(ids.length-1))/2);
 for(let attempt=0;attempt<80;attempt++){
  const degree=Object.fromEntries(ids.map(id=>[id,0]));
  const partner=Object.fromEntries(ids.map(id=>[id,{}]));
  const pairs=[];
  for(let step=0;step<total;step++){
   const candidates=[];
   for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const a=ids[i],b=ids[j];if(degree[a]>=target||degree[b]>=target||(partner[a][b]||0)>=maxPartnerUses)continue;
    candidates.push({a,b,score:(partner[a][b]||0)*10000+(degree[a]+degree[b])*30+Math.random()*5});
   }
   candidates.sort((a,b)=>a.score-b.score);if(!candidates.length)break;
   const pick=candidates[0];pairs.push([pick.a,pick.b]);degree[pick.a]++;degree[pick.b]++;partner[pick.a][pick.b]=(partner[pick.a][pick.b]||0)+1;partner[pick.b][pick.a]=(partner[pick.b][pick.a]||0)+1;
  }
  if(pairs.length===total&&ids.every(id=>degree[id]===target))return pairs;
 }
 return null;
}
function maxDisjointPack(games,target){
  if(!games.length||target<=0)return 0;
  const limit=Math.min(target,3),masks=games.map(g=>new Set([...g.a,...g.b]));
  function dfs(start,chosen,used){
    if(chosen>=limit)return chosen;
    let best=chosen;
    for(let i=start;i<masks.length;i++){
      let clash=false;for(const id of masks[i])if(used.has(id)){clash=true;break}
      if(clash)continue;
      const next=new Set(used);masks[i].forEach(id=>next.add(id));
      best=Math.max(best,dfs(i+1,chosen+1,next));
      if(best===limit)return best;
    }
    return best;
  }
  return dfs(0,0,new Set());
}
function selectDisjointGames(t,count){
  const candidates=candidatePool(t);
  if(!candidates.length||count<=0)return [];
  const ordered=candidates.sort((a,b)=>candidateScore(t,t.games[a])-candidateScore(t,t.games[b]));
  const chosen=[];
  function dfs(start,used){
    if(chosen.length===count)return true;
    for(let i=start;i<ordered.length;i++){
      const idx=ordered[i],g=t.games[idx],ids=[...g.a,...g.b];
      if(ids.some(id=>used.has(id)))continue;
      chosen.push(idx);ids.forEach(id=>used.add(id));
      if(dfs(i+1,used))return true;
      ids.forEach(id=>used.delete(id));chosen.pop();
    }
    return false;
  }
  return dfs(0,new Set())?chosen.slice():[];
}
function buildRoundRobinSchedule(players,target,courts=1){
  const ids=players.map(p=>p.id),total=calcGames(ids.length,target),desiredCourts=Math.min(courts,Math.floor(ids.length/4));
  let best={games:[],score:Infinity,pack:0};
  for(let attempt=0;attempt<160;attempt++){
    const remaining=Object.fromEntries(ids.map(id=>[id,target]));
    const partner=Object.fromEntries(ids.map(id=>[id,{}])),opp=Object.fromEntries(ids.map(id=>[id,{}])),used=new Set(),games=[];
    let failed=false;
    for(let step=0;step<total;step++){
      let pick=null;
      for(let tries=0;tries<220&&!pick;tries++){
        const eligible=shuffle(ids.filter(id=>remaining[id]>0)).sort((a,b)=>remaining[b]-remaining[a]||Math.random()-.5);
        if(eligible.length<4)break;
        const q=eligible.slice(0,Math.min(8,eligible.length)).sort((a,b)=>remaining[b]-remaining[a]||Math.random()-.5).slice(0,4);
        if(new Set(q).size!==4)continue;
        const splits=[[[q[0],q[1]],[q[2],q[3]]],[[q[0],q[2]],[q[1],q[3]]],[[q[0],q[3]],[q[1],q[2]]]];
        const choices=[];
        for(const [a,b] of splits){
          const key=gameKey(...a,...b);if(used.has(key))continue;
          const repeatPartner=(partner[a[0]][a[1]]||0)+(partner[b[0]][b[1]]||0);
          const repeatOpp=a.reduce((sum,x)=>sum+b.reduce((z,y)=>z+(opp[x][y]||0),0),0);
          const balance=q.reduce((sum,id)=>sum+remaining[id],0);
          choices.push({a,b,score:repeatPartner*10000+repeatOpp*100+balance*2+Math.random()*10});
        }
        if(choices.length){choices.sort((a,b)=>a.score-b.score);pick=choices[0]}
      }
      if(!pick){failed=true;break}
      const {a,b}=pick;games.push({a:a.slice(),b:b.slice()});used.add(gameKey(...a,...b));
      for(const id of [...a,...b])remaining[id]--;
      partner[a[0]][a[1]]=(partner[a[0]][a[1]]||0)+1;partner[a[1]][a[0]]=(partner[a[1]][a[0]]||0)+1;
      partner[b[0]][b[1]]=(partner[b[0]][b[1]]||0)+1;partner[b[1]][b[0]]=(partner[b[1]][b[0]]||0)+1;
      for(const x of a)for(const y of b){opp[x][y]=(opp[x][y]||0)+1;opp[y][x]=(opp[y][x]||0)+1}
    }
    if(failed||games.length!==total||ids.some(id=>remaining[id]!==0))continue;
    let repeat=0;for(const id of ids)for(const v of Object.values(partner[id]))repeat+=Math.max(0,v-1);
    let or=0;for(const id of ids)for(const v of Object.values(opp[id]))or+=Math.max(0,v-1);
    const pack=maxDisjointPack(games,desiredCourts),score=repeat*100+or+(desiredCourts-pack)*10000;
    if(score<best.score){best={games,score,pack};if(score===0)break}
  }
  return best.games.length===total&&best.pack>=desiredCourts?best.games:null;
}
function buildSchedule(t){
  const total=calcGames(t.playerCount,t.gamesPerPlayer);let raw=null;
  if(t.type==="Team vs Team"){
    const sky=t.teams.sky,net=t.teams.net;
    for(let attempt=0;attempt<80&&!raw;attempt++){
      const sp=buildTeamSchedule(shuffle(sky),t.gamesPerPlayer),np=buildTeamSchedule(shuffle(net),t.gamesPerPlayer);if(!sp||!np)continue;
      const partner=Object.fromEntries(t.players.map(p=>[p.id,{}])),opp=Object.fromEntries(t.players.map(p=>[p.id,{}]));
      raw=[];const remaining=shuffle(np),usedGames=new Set();
      for(const a of sp){let best=-Infinity,bi=-1;for(let i=0;i<remaining.length;i++){const b=remaining[i],key=gameKey(...a,...b);if(usedGames.has(key))continue;let score=0;for(const x of a)for(const y of b)score-=(opp[x][y]||0)*100;score+=Math.random()*10;if(score>best){best=score;bi=i}}if(bi<0){raw=null;break}const b=remaining.splice(bi,1)[0];usedGames.add(gameKey(...a,...b));raw.push({a:a.slice(),b:b.slice()});for(const x of a)for(const y of b){opp[x][y]=(opp[x][y]||0)+1;opp[y][x]=(opp[y][x]||0)+1}}
      if(!raw||raw.length!==total||maxDisjointPack(raw,Math.min(t.courts,Math.floor(t.playerCount/4)))<Math.min(t.courts,Math.floor(t.playerCount/4)))raw=null;
    }
  }else raw=buildRoundRobinSchedule(t.players,t.gamesPerPlayer,t.courts);
  return raw;
}
function playerMap(t){return Object.fromEntries(t.players.map(p=>[p.id,p]));}
function liveIds(t){return new Set(t.games.filter(g=>g.status==="live").flatMap(g=>[...g.a,...g.b]));}
function availableIds(t){return new Set(t.players.filter(p=>p.present===true).map(p=>p.id));}
function candidatePool(t,occupied=new Set()){
  const avail=availableIds(t),live=liveIds(t),out=[];
  for(let i=0;i<t.games.length;i++){const g=t.games[i];if(g.status!=="queued")continue;const ids=[...g.a,...g.b];if(ids.some(id=>!avail.has(id)||live.has(id)||occupied.has(id)))continue;out.push(i)}return out;
}
function restScore(t,g){
  const now=Date.now();let score=0;
  for(const id of [...g.a,...g.b]){const ps=t.playerState[id]||{};const last=ps.lastPlayed||0;const minutes=last?Math.max(0,(now-last)/60000):999;score-=Math.min(minutes,30)*3;score+=(ps.gamesSinceRest||0)*45;score+=(ps.partnerCounts?.[pairKey(...(g.a.includes(id)?g.a:g.b))]||0)*180}
  return score;
}
function candidateScore(t,g){
  const ids=[...g.a,...g.b],remaining=ids.reduce((s,id)=>s+t.games.filter(x=>x.status!=="done"&&[...x.a,...x.b].includes(id)).length,0);
  let repeat=0;for(const side of [g.a,g.b])repeat+=t.playerState[side[0]]?.partnerCounts?.[side[1]]||0;
  let opp=0;for(const x of g.a)for(const y of g.b)opp+=(t.playerState[x]?.opponentCounts?.[y]||0);
  return restScore(t,g)+repeat*220+opp*55-remaining*12+Math.random()*3;
}
function chooseCandidate(t,occupied=new Set(),exclude=new Set()){
  const inds=candidatePool(t,occupied).filter(i=>!exclude.has(i));if(!inds.length)return null;inds.sort((a,b)=>candidateScore(t,t.games[a])-candidateScore(t,t.games[b]));return inds[0];
}
function assignInitialCourts(t){
  const max=Math.min(t.courts,Math.floor(t.players.filter(p=>p.present===true).length/4));
  const selected=selectDisjointGames(t,max);
  return selected.map((idx,c)=>{const g=t.games[idx];g.status="live";g.court=c+1;g.startedAt=Date.now();return g});
}
function promote(t,court){const idx=chooseCandidate(t);if(idx==null)return null;const g=t.games[idx];g.status="live";g.court=court;g.startedAt=Date.now();return g}
function nextCandidates(t,count=6){const used=new Set(),out=[];for(let i=0;i<count;i++){const idx=chooseCandidate(t,used);if(idx==null)break;const g=t.games[idx];out.push(g);g.a.concat(g.b).forEach(id=>used.add(id))}return out}
function updateHistory(t,g){const now=Date.now();const playing=new Set([...g.a,...g.b]);for(const p of t.players){const ps=t.playerState[p.id]??={lastPlayed:0,gamesSinceRest:0,partnerCounts:{},opponentCounts:{}};if(p.present===true&&!playing.has(p.id))ps.gamesSinceRest=(ps.gamesSinceRest||0)+1;}for(const id of playing){const ps=t.playerState[id]??={lastPlayed:0,gamesSinceRest:0,partnerCounts:{},opponentCounts:{}};ps.lastPlayed=now;ps.gamesSinceRest=0;const side=g.a.includes(id)?g.a:g.b;const partner=side.find(x=>x!==id);if(partner)ps.partnerCounts[partner]=(ps.partnerCounts[partner]||0)+1;const opponents=g.a.includes(id)?g.b:g.a;for(const op of opponents)ps.opponentCounts[op]=(ps.opponentCounts[op]||0)+1}}
function finishLeagueGame(id,s1,s2){const t=state.tournament,g=t.games.find(x=>x.id===id);if(!g||g.status!=="live")return;const court=g.court;g.score=[s1,s2];g.status="done";g.finishedAt=Date.now();g.winner=s1>s2?0:1;updateHistory(t,g);g.court=null;promote(t,court);save();render();}
function rankings(t){const r=Object.fromEntries(t.players.map(p=>[p.id,{id:p.id,name:p.name,team:p.team,gp:0,w:0,l:0,wp:0,pf:0,pa:0,pd:0}]));for(const g of t.games.filter(x=>x.status==="done"&&x.score)){const [a,b]=g.score;for(const id of g.a){r[id].gp++;r[id].pf+=a;r[id].pa+=b;r[id].pd+=a-b}for(const id of g.b){r[id].gp++;r[id].pf+=b;r[id].pa+=a;r[id].pd+=b-a}if(a>b){g.a.forEach(id=>r[id].w++);g.b.forEach(id=>r[id].l++)}else{g.b.forEach(id=>r[id].w++);g.a.forEach(id=>r[id].l++)}}
  return Object.values(r).map(x=>({...x,wp:x.gp?x.w/x.gp:0})).sort((a,b)=>b.w-a.w||b.wp-a.wp||b.pd-a.pd||b.pf-a.pf||a.name.localeCompare(b.name)).map((x,i)=>({...x,rank:i+1}));
}
function leagueComplete(t){return t.games.length>0&&t.games.every(g=>g.status==="done")}
function fixture(g,t){const p=playerMap(t);return `<span class="player-name">${g.a.map(id=>esc(p[id]?.name||id)).join(" + ")}</span> <span class="muted">VS</span> <span class="player-name">${g.b.map(id=>esc(p[id]?.name||id)).join(" + ")}</span>`}
function save(){if(state.tournament){localStorage.setItem(KEY,JSON.stringify(state.tournament));syncTournament()}}
function load(){try{state.tournament=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem(OLD_KEY)||"null");if(state.tournament&&!state.tournament.playerState){state.tournament.playerState=Object.fromEntries(state.tournament.players.map(p=>[p.id,{lastPlayed:0,gamesSinceRest:0,partnerCounts:{},opponentCounts:{}}]));localStorage.setItem(KEY,JSON.stringify(state.tournament))}}catch{state.tournament=null}}
function encodeBoard(t){return btoa(unescape(encodeURIComponent(JSON.stringify(t))))}
function decodeBoard(raw){try{return JSON.parse(decodeURIComponent(escape(atob(raw))))}catch{return null}}
function makeBoardLink(t){const url=new URL(window.location.href);url.hash="";url.searchParams.set("board",t.id);return url.toString()}
function defaultDraft(){return{players:12,courts:2,hours:2,gpp:9,type:"Round Robin",names:[]}}
function captureDraft(){const d=state.adminDraft||defaultDraft();for(const id of ["players","courts","hours","gpp"]){const el=$("#"+id);if(!el)continue;d[id]=el.value==="manual"?"manual":num(el.value,d[id])}d.type=$("#type")?.value||d.type;d.names=[...document.querySelectorAll(".rr-input,.sky-input,.net-input")].map(x=>x.value);state.adminDraft=d;return d}
function manualValue(id,fallback){const el=$("#"+id);return el?.value==="manual"?num($("#m_"+id)?.value,fallback):num(el?.value,fallback)}
function manualFields(){const d=state.adminDraft||defaultDraft(),defs=[["players",4,18,12,"Players"],["courts",1,3,2,"Courts"],["hours",1,12,2,"Hours"],["gpp",1,12,9,"Games / player"]];return defs.filter(([id])=>$("#"+id)?.value==="manual").map(([id,min,max,fb,label])=>`<div><label>${label} manual value</label><input id="m_${id}" class="field" type="number" min="${min}" max="${max}" value="${num(d[id+"Value"],fb)}"></div>`).join("")}
function renderAdmin(){const d=state.adminDraft||defaultDraft(),type=d.type||"Round Robin",pc=d.players==="manual"?num(d.playersValue,12):num(d.players,12);document.querySelector("#app").innerHTML=`<div class="container"><section class="hero"><div class="eyebrow">${APP_VERSION} Â· TOURNAMENT BUILDER</div><h1>SHUTTLE SYNDICATE</h1><p class="muted">Configure the tournament, then let the scheduling engine manage the live flow.</p></section><section class="card admin-section"><div class="section-head"><div><div class="eyebrow">SETUP</div><h2>Admin Configuration</h2><p class="muted small">This is the permanent tournament setup page. Create a new weekly tournament here.</p></div><span class="notice">12 min planning standard</span></div><div class="grid grid2"><div><label>No. of Players</label><select id="players" class="field">${Array.from({length:15},(_,i)=>i+4).map(i=>`<option value="${i}" ${String(d.players)==String(i)?"selected":""}>${i}</option>`).join("")}<option value="manual" ${d.players==="manual"?"selected":""}>Manual</option></select></div><div><label>No. of Courts</label><select id="courts" class="field">${[1,2,3].map(i=>`<option value="${i}" ${String(d.courts)==String(i)?"selected":""}>${i}</option>`).join("")}<option value="manual" ${d.courts==="manual"?"selected":""}>Manual</option></select></div><div><label>Scheduled Hours</label><select id="hours" class="field">${[1,2,3].map(i=>`<option value="${i}" ${String(d.hours)==String(i)?"selected":""}>${i}</option>`).join("")}<option value="manual" ${d.hours==="manual"?"selected":""}>Manual</option></select></div><div><label>League Matches / Player</label><select id="gpp" class="field">${Array.from({length:12},(_,i)=>i+1).map(i=>`<option value="${i}" ${String(d.gpp)==String(i)?"selected":""}>${i}</option>`).join("")}<option value="manual" ${d.gpp==="manual"?"selected":""}>Manual</option></select></div><div><label>Tournament Type</label><select id="type" class="field"><option value="Round Robin" ${type==="Round Robin"?"selected":""}>Round Robin</option><option value="Team vs Team" ${type==="Team vs Team"?"selected":""}>Team vs Team</option></select></div></div><div id="manuals" class="grid grid2 manuals"></div><div id="configNotice"></div></section><section id="playerEditor"></section><section class="card admin-section engine-section"><div class="eyebrow">ENGINE</div><h2>Two-Layer Scheduling</h2><p class="muted small">Layer 1 builds equal 2v2 candidates. Layer 2 selects by availability, rest, partner/opponent history and court flow.</p><div id="capacity"></div><button class="btn good wide" id="generate">Generate Tournament &amp; Game Board Link</button>${state.generatedLink?`<div class="generated-link"><div class="notice ok"><b>Tournament created.</b> Game Board link is ready.</div><input class="field" readonly id="boardLink" value="${esc(state.generatedLink)}"><div class="row"><button class="btn" id="copyLink">Copy Game Board Link</button><button class="btn good" id="openBoard">Open Game Board</button></div><div class="small muted">V1.4.5 shared link: tournament state is stored centrally when Supabase realtime is configured. Players receive live updates without Admin controls.</div></div>`:""}</section><div class="footer-flow">Created by Irfan Shaik Â· ${APP_VERSION}</div></div>`;bindAdmin();}
function bindAdmin(){["players","courts","hours","gpp","type"].forEach(id=>$("#"+id).onchange=()=>{captureDraft();renderAdmin()});$("#manuals").innerHTML=manualFields();for(const id of ["players","courts","hours","gpp"]){$("#m_"+id)?.addEventListener("change",e=>{const d=state.adminDraft||defaultDraft();d[id+"Value"]=num(e.target.value,id==="players"?12:id==="courts"?2:id==="hours"?2:9);state.adminDraft=d;renderAdmin()})}const type=$("#type").value,pc=manualValue("players",12),courts=manualValue("courts",2),hours=manualValue("hours",2),gpp=manualValue("gpp",9),total=calcGames(pc,gpp),cap=Math.floor(courts*durationMinutes(hours)/12);$("#configNotice").innerHTML=Number.isInteger(total)&&type!=="Team vs Team"||Number.isInteger(total)&&pc%2===0?`<div class="notice ok">${total} equal 2v2 league games Â· estimated ${cap} game slots at ${courts} court(s).</div>`:`<div class="notice danger-box">Team vs Team requires an even player count, and players Ã— games/player must be divisible by 4.</div>`;const names=state.adminDraft?.names||[];if(type==="Team vs Team"){const half=Math.floor(pc/2);$("#playerEditor").innerHTML=`<section class="dual-team admin-section"><div class="team-panel team-sky"><div class="team-title sky">SKY SMASHERS</div><div class="small muted">Ocean Blue Â· ${half} players</div><div class="players-grid">${Array.from({length:half},(_,i)=>`<input class="field sky-input" value="${esc(names[i]||"")}" placeholder="Sky player ${i+1}">`).join("")}</div></div><div class="team-panel team-net"><div class="team-title net">NET HUNTERS</div><div class="small muted">Fiery Red / Orange Â· ${half} players</div><div class="players-grid">${Array.from({length:half},(_,i)=>`<input class="field net-input" value="${esc(names[i+half]||"")}" placeholder="Net player ${i+1}">`).join("")}</div></div></section>`}else $("#playerEditor").innerHTML=`<section class="card admin-section"><div class="eyebrow">ROSTER</div><h2>Round Robin Players</h2><div class="players-grid">${Array.from({length:pc},(_,i)=>`<input class="field rr-input" value="${esc(names[i]||"")}" placeholder="Player ${i+1}">`).join("")}</div></section>`;$("#generate").onclick=generate;$("#copyLink")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(state.generatedLink);alert("Game Board link copied.")}catch{$("#boardLink").select();document.execCommand("copy");alert("Game Board link copied.")}});$("#openBoard")?.addEventListener("click",async()=>{const url=new URL(state.generatedLink,window.location.href);const id=url.searchParams.get("board")||(url.hash.startsWith("#board=")?decodeURIComponent(url.hash.slice(7)):"");if(!id)return;state.shared=true;state.page="teams";await connectSharedTournament(id)})}
function generate(){
 const type=$("#type").value,pc=manualValue("players",12),courts=manualValue("courts",2),hours=manualValue("hours",2),gpp=manualValue("gpp",9);
 if(!validConfig(pc,courts,hours,gpp,type)){alert("Check the configuration. Player count/type, games/player divisibility, and unique-game limits must all be valid.");return}
 let players=[];
 if(type==="Team vs Team"){
  const half=pc/2;
  const sky=[...document.querySelectorAll(".sky-input")].map((x,i)=>({id:"P"+String(i+1).padStart(2,"0"),name:x.value.trim()||`Sky Player ${i+1}`,team:"sky",present:false}));
  const net=[...document.querySelectorAll(".net-input")].map((x,i)=>({id:"P"+String(i+half+1).padStart(2,"0"),name:x.value.trim()||`Net Player ${i+half+1}`,team:"net",present:false}));
  players=[...sky,...net];
 }else{
  players=[...document.querySelectorAll(".rr-input")].map((x,i)=>({id:"P"+String(i+1).padStart(2,"0"),name:x.value.trim()||`Player ${i+1}`,team:null,present:false}));
 }
 const t={id:uid(),type,playerCount:pc,courts,hours,gamesPerPlayer:gpp,players,teams:type==="Team vs Team"?{sky:players.filter(p=>p.team==="sky").map(p=>p.id),net:players.filter(p=>p.team==="net").map(p=>p.id)}:null,createdAt:Date.now(),matchPlanMinutes:12,started:false,games:[],playerState:Object.fromEntries(players.map(p=>[p.id,{lastPlayed:0,gamesSinceRest:0,partnerCounts:{},opponentCounts:{}}])),playoff:{}};
 const raw=buildSchedule(t);
 if(!raw||raw.length!==calcGames(pc,gpp)){alert("The engine could not produce a unique equal schedule for this configuration. Reduce games/player or choose another player count.");return}
 t.games=raw.map((g,i)=>({...g,id:"G"+String(i+1).padStart(2,"0"),status:"queued",court:null,score:null}));
 state.tournament=t;state.adminDraft={players:pc,courts,hours,gpp,type,names:players.map(p=>p.name)};state.generatedLink=makeBoardLink(t);save();renderAdmin()
}
function nav(){return `<nav class="nav"><button data-page="teams" class="${state.page==="teams"?"active":""}"><span class="ico">â—ˆ</span>Teams</button><button data-page="live" class="${state.page==="live"?"active":""}"><span class="ico">â—</span>Live</button><button data-page="schedule" class="${state.page==="schedule"?"active":""}"><span class="ico">â˜·</span>Schedule / Ranking</button><button data-page="playoffs" class="${state.page==="playoffs"?"active":""}"><span class="ico">â™›</span>Playoffs</button></nav>`}
function header(t){return `<header class="topbar"><div><div class="brand">SHUTTLE <span>SYNDICATE</span></div><div class="subbrand">${esc(t.type).toUpperCase()} Â· ${APP_VERSION}</div></div>${state.shared?"":`<button class="admin-link" id="adminHome">ADMIN</button>`}</header>`}
function meta(t){return `<div class="meta-row"><span>${t.playerCount} players</span><span>${t.courts} courts</span><span>${t.hours} hour(s)</span><span>${t.gamesPerPlayer} games/player</span><span>${t.games.length} league games</span></div>`}
function teamsPage(t){let content=`<section class="hero page-hero"><div class="eyebrow">TOURNAMENT BOARD Â· ${esc(t.id)}</div><h1>${esc(t.type)}</h1>${meta(t)}</section>`;if(t.type==="Team vs Team")content+=`<section class="dual-team board-teams"><div class="team-panel team-sky"><div class="team-title sky">SKY SMASHERS</div>${t.teams.sky.map(id=>`<div class="player-card">${esc(playerMap(t)[id]?.name||id)}</div>`).join("")}</div><div class="team-panel team-net"><div class="team-title net">NET HUNTERS</div>${t.teams.net.map(id=>`<div class="player-card">${esc(playerMap(t)[id]?.name||id)}</div>`).join("")}</div></section>`;else content+=`<section class="card compact-section"><div class="eyebrow">ROSTER</div><h2>Players</h2><div class="players-grid">${t.players.map((p,i)=>`<div class="player-card">${String(i+1).padStart(2,"0")} Â· ${esc(p.name)}</div>`).join("")}</div></section>`;if(!t.started)content+=checkInPanel(t);return content}
function checkInPanel(t){const checked=t.players.filter(p=>p.present===true).length;return `<section class="card start-panel"><div class="section-head"><div><div class="eyebrow">LEAGUE CHECK-IN</div><h2>Ready to start</h2><p class="muted small">All players start unchecked. Select only the players who are physically available now; late arrivals can be checked in later.</p></div><span class="notice ${checked>=4?"ok":""}">${checked}/${t.playerCount} available</span></div><div class="check-grid">${t.players.map(p=>`<label class="check-card"><input type="checkbox" data-present="${p.id}" ${p.present===true?"checked":""}><span>${esc(p.name)}</span><small>${t.type==="Team vs Team"?(p.team==="sky"?"Sky Smashers":"Net Hunters"):"Round Robin"}</small></label>`).join("")}</div><button class="btn good wide" id="startLeague" ${checked<4?"disabled":""}>START LEAGUE</button></section>`}
function livePage(t){
 const done=t.games.filter(g=>g.status==="done").length;
 const live=t.games.filter(g=>g.status==="live").sort((a,b)=>(a.court||0)-(b.court||0));
 if(!t.started){return `<section class="hero page-hero"><div class="eyebrow">LIVE</div><h1>READY TO START</h1><div class="meta-row"><span>${done}/${t.games.length} completed</span><span>${t.players.filter(p=>p.present===true).length}/${t.playerCount} available</span></div></section>${checkInPanel(t)}`}
 const flow=nextCandidates(t,Math.max(6,t.courts+4));
 const upcoming=flow.slice(0,t.courts);
 const onDeck=flow.slice(t.courts);
 const courts=Array.from({length:t.courts},(_,i)=>{const g=live.find(x=>x.court===i+1);return g?courtCard(t,g):`<div class="court empty-court"><div class="court-head"><b>COURT ${i+1}</b><span class="muted">WAITING</span></div><div class="muted">No eligible game yet. Check player availability.</div></div>`}).join("");
 const next=upcoming.length?upcoming.map((g,i)=>`<div class="next-item ${i===0?"best":""}"><div class="next-label">${i<t.courts?"NEXT":"CANDIDATE"} Â· ${g.id}</div><div class="fixture">${fixture(g,t)}</div><div class="small muted">Availability Â· rest Â· partner/opponent history Â· remaining games</div></div>`).join(""):'<div class="muted">No eligible next game. Waiting for available players.</div>';
 const deck=onDeck.length?onDeck.map(g=>`<div class="next-item"><div class="next-label">${g.id}</div><div class="fixture">${fixture(g,t)}</div></div>`).join(""):'<div class="muted small">No additional eligible candidates.</div>';
 return `<section class="hero page-hero"><div class="eyebrow">LIVE</div><h1>LEAGUE IN PROGRESS</h1><div class="meta-row"><span>${done}/${t.games.length} completed</span><span>${live.length}/${t.courts} courts active</span><span>${t.players.filter(p=>p.present===true).length}/${t.playerCount} available</span></div></section><section class="live-grid">${courts}</section><section class="card compact-section"><div class="section-head"><div><div class="eyebrow">PLAYER AVAILABILITY</div><h2>Check-in status</h2></div><span class="small muted">Unavailable players are excluded from future games.</span></div><div class="check-grid">${t.players.map(p=>{const busy=live.some(g=>[...g.a,...g.b].includes(p.id));return `<label class="check-card"><input type="checkbox" data-present="${p.id}" ${p.present===true?"checked":""} ${busy?"disabled":""}><span>${esc(p.name)}</span><small>${busy?"Playing now":(p.present!==false?"Available":"Unavailable")}</small></label>`}).join("")}</div></section><section class="card next-section"><div class="section-head"><div><div class="eyebrow">FLOW</div><h2>NEXT</h2></div><span class="small muted">Dynamic candidate selection</span></div><div class="next-list">${next}</div><div class="eyebrow deck-title">ON DECK</div><div class="next-list">${deck}</div></section>`;
}
function courtCard(t,g){const scoreA=g.score?.[0]??"",scoreB=g.score?.[1]??"";const scoreUI=state.canScore?`<div class="score-row"><div class="score-box sky"><div class="score-label">SIDE A</div><input inputmode="numeric" pattern="[0-9]*" value="" id="s1-${g.id}"></div><div class="vs">â€”</div><div class="score-box net"><div class="score-label">SIDE B</div><input inputmode="numeric" pattern="[0-9]*" value="" id="s2-${g.id}"></div></div><button class="btn good wide" onclick="submitScore('${g.id}')">CONFIRM SCORE</button>`:`<div class="score-row"><div class="score-box sky"><div class="score-label">SIDE A</div><div class="score-display">${scoreA||"â€”"}</div></div><div class="vs">â€”</div><div class="score-box net"><div class="score-label">SIDE B</div><div class="score-display">${scoreB||"â€”"}</div></div></div>`;return `<div class="court"><div class="court-head"><div><span class="live-dot"></span><b>COURT ${g.court}</b></div><span class="small">NOW Â· ${g.id}</span></div><div class="live-matchup"><div class="live-side pair">${g.a.map(id=>esc(playerMap(t)[id]?.name||id)).join(" + ")}</div><div class="vs">VS</div><div class="live-side pair">${g.b.map(id=>esc(playerMap(t)[id]?.name||id)).join(" + ")}</div></div>${scoreUI}</div>`}
window.submitScore=id=>{const a=num($("#s1-"+id)?.value,-1),b=num($("#s2-"+id)?.value,-1);if(a<0||b<0||a===b){alert("Enter two different non-negative scores.");return}if(!confirm(`Confirm ${a} - ${b} for ${id}?`))return;finishLeagueGame(id,a,b)};
function schedulePage(t){const selected=state.playerFilter||"ALL",gs=t.games.filter(g=>selected==="ALL"||[...g.a,...g.b].includes(selected)),r=rankings(t);return `<section class="hero page-hero"><div class="eyebrow">SCHEDULE / RANKING</div><h1>SCHEDULE / RANKING</h1><div class="filter"><select class="field" id="playerFilter"><option value="ALL" ${selected==="ALL"?"selected":""}>ALL â€” ENTIRE SCHEDULE</option>${t.players.map(p=>`<option value="${p.id}" ${selected===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select><span class="small muted">Live court order may change dynamically.</span></div></section><section class="card compact-section"><div class="section-head"><h2>${selected==="ALL"?"Entire Schedule":esc(playerMap(t)[selected]?.name||"Player")+"'s Fixtures"}</h2><span class="small muted">${gs.length} fixture(s)</span></div><div class="schedule-list">${gs.map(g=>scheduleRow(t,g)).join("")}</div></section>${rankingBoard(t,r)}`}
function scheduleRow(t,g){const result=g.score?`${g.score[0]} â€” ${g.score[1]}`:"";return `<div class="game-row ${g.status}"><div><b>${g.id}</b><div class="small muted">${g.court?"C"+g.court:"â€”"}</div></div><div class="fixture">${fixture(g,t)}${result?`<div class="score-result">${result}</div>`:""}</div><span class="status ${g.status}">${g.status==="done"?"COMPLETED":g.status==="live"?"LIVE":"UPCOMING"}</span>${g.status==="done"?`<button class="btn tiny" onclick="editLeagueScore('${g.id}')">EDIT SCORE</button>`:""}</div>`}
window.editLeagueScore=id=>{const t=state.tournament,g=t.games.find(x=>x.id===id);if(!g?.score)return;const a=prompt(`Edit ${id} â€” Side A score`,g.score[0]);if(a===null)return;const b=prompt(`Edit ${id} â€” Side B score`,g.score[1]);if(b===null)return;const s1=num(a,-1),s2=num(b,-1);if(s1<0||s2<0||s1===s2){alert("Enter two different non-negative scores.");return}g.score=[s1,s2];g.winner=s1>s2?0:1;t.playoff={};save();render()};
function rankingBoard(t,r){if(t.type==="Team vs Team")return `<section class="dual-team ranking-grid">${teamRank(t,"SKY SMASHERS","sky",r.filter(x=>x.team==="sky"))}${teamRank(t,"NET HUNTERS","net",r.filter(x=>x.team==="net"))}</section>`;return `<section class="card compact-section"><div class="section-head"><h2>Round Robin Ranking</h2><span class="notice ok">Top 8 qualify after league</span></div>${rankTable(r,8)}</section>`}
function teamRank(t,title,cls,arr){const ranked=arr.map((x,i)=>({...x,rank:i+1}));const top=t.playerCount>=16?6:4;return `<div class="card ${cls==="sky"?"team-sky":"team-net"}"><div class="team-title ${cls}">${title}</div><div class="small muted">${top===6?"#1â€“#2 direct semifinals Â· #3â€“#6 qualifier path":"TOP 4 PLAYOFF QUALIFIERS"}</div>${rankTable(ranked,top,4)}</div>`}
function rankTable(arr,qual,highlight=qual){return `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>PLAYER</th><th>M</th><th>W</th><th>L</th><th>WIN %</th><th>PF</th><th>PA</th><th>DIFF</th></tr></thead><tbody>${arr.map(r=>`<tr class="${r.rank<=highlight?"qual":""}"><td><span class="rank-badge">${r.rank}</span></td><td><b>${esc(r.name)}</b></td><td>${r.gp}</td><td>${r.w}</td><td>${r.l}</td><td>${Math.round(r.wp*100)}%</td><td>${r.pf}</td><td>${r.pa}</td><td>${r.pd>=0?"+":""}${r.pd}</td></tr>`).join("")}</tbody></table></div>`}
function playoffState(t){t.playoff??={};return t.playoff}
function playoffMatchCard(t,m,key){const p=playoffState(t);if(!m)return "";const score=m.score;return `<div class="match-card ${m.winner!==undefined?"complete":""}"><div class="match-title">${esc(m.label)}</div><div class="team-line"><span>${esc(m.sideA||"Waiting")}</span><b>${score?score[0]:"â€”"}</b></div><div class="team-line"><span>${esc(m.sideB||"Waiting")}</span><b>${score?score[1]:"â€”"}</b></div>${m.sideA&&m.sideB&&!score?`<div class="playoff-score"><input class="field" id="po-a-${key}" inputmode="numeric" placeholder="Score"><input class="field" id="po-b-${key}" inputmode="numeric" placeholder="Score"><button class="btn good wide" onclick="submitPlayoffScore('${key}')">CONFIRM SCORE</button></div>`:""}${m.winner!==undefined?`<div class="winner-line">WINNER Â· ${esc(m.winner)}</div>`:""}</div>`}
function setupTeamPlayoffs(t){const p=playoffState(t);if(p.mode)return p;const r=rankings(t),sky=r.filter(x=>x.team==="sky"),net=r.filter(x=>x.team==="net"),large=t.playerCount>=16;if(!leagueComplete(t))return p;p.mode="team";p.large=large;p.matches={};if(large){p.matches.q1={label:"QUALIFIER 1",sideA:`${sky[2].name} + ${sky[4].name}`,sideB:`${net[3].name} + ${net[5].name}`};p.matches.q2={label:"QUALIFIER 2",sideA:`${sky[3].name} + ${sky[5].name}`,sideB:`${net[2].name} + ${net[4].name}`};p.matches.sf1={label:"SEMI-FINAL 1",sideA:`${sky[0].name} + ${sky[1].name}`,sideB:"Winner Q1"};p.matches.sf2={label:"SEMI-FINAL 2",sideA:`${net[0].name} + ${net[1].name}`,sideB:"Winner Q2"};}else{p.matches.sf1={label:"SEMI-FINAL 1",sideA:`${sky[0].name} + ${sky[2].name}`,sideB:`${net[1].name} + ${net[3].name}`};p.matches.sf2={label:"SEMI-FINAL 2",sideA:`${sky[1].name} + ${sky[3].name}`,sideB:`${net[0].name} + ${net[2].name}`};}p.matches.final={label:"FINAL",sideA:"Winner SF1",sideB:"Winner SF2"};save();return p}
function setupRRPlayoffs(t){const p=playoffState(t);if(p.mode)return p;if(!leagueComplete(t))return p;p.mode="rr";p.cards={};p.matches={sf1:{label:"SEMI-FINAL 1",sideA:"Team 1",sideB:"Team 3"},sf2:{label:"SEMI-FINAL 2",sideA:"Team 2",sideB:"Team 4"},final:{label:"FINAL",sideA:"Winner SF1",sideB:"Winner SF2"}};save();return p}
function playoffTeamFromCards(t,cardNo){const p=playoffState(t);return Object.entries(p.cards||{}).filter(([,n])=>Number(n)===cardNo).map(([rank])=>rankings(t).find(x=>x.rank===Number(rank))?.name).filter(Boolean)}
function rrCardsUI(t,p){const q=rankings(t).slice(0,8);const cards=p.cards||{};const counts=[1,2,3,4].reduce((o,n)=>(o[n]=Object.values(cards).filter(v=>Number(v)===n).length,o),{});return `<section class="card compact-section"><div class="section-head"><div><div class="eyebrow">TRUMP CARD CEREMONY</div><h2>Ranked picks</h2></div><span class="small muted">#1 picks first Â· #8 picks last Â· 2 players per card</span></div><div class="card-picks">${q.map(x=>`<div class="pick-row"><b>#${x.rank} ${esc(x.name)}</b><select class="field" data-card-rank="${x.rank}"><option value="">Select card</option>${[1,2,3,4].map(n=>`<option value="${n}" ${Number(cards[x.rank])===n?"selected":""} ${counts[n]>=2&&Number(cards[x.rank])!==n?"disabled":""}>Card ${n} (${counts[n]}/2)</option>`).join("")}</select></div>`).join("")}</div><div class="trump-grid">${[1,2,3,4].flatMap(n=>[0,1].map(()=>`<div class="trump-card c${n}"><b>${n}</b><span>TRUMP</span></div>`)).join("")}</div></section>`}
function playoffPage(t){if(!t.started)return `<section class="hero page-hero"><div class="eyebrow">PLAYOFFS</div><h1>Waiting for league</h1><p class="muted">Complete the league stage before playoff qualification is activated.</p></section>`;if(!leagueComplete(t))return `<section class="hero page-hero"><div class="eyebrow">PLAYOFFS</div><h1>League stage in progress</h1><p class="muted">${t.games.filter(g=>g.status==="done").length}/${t.games.length} league games completed. Rankings remain live; playoff positions are provisional.</p></section>`;const p=t.type==="Team vs Team"?setupTeamPlayoffs(t):setupRRPlayoffs(t);if(t.type==="Round Robin"){const q=rankings(t).slice(0,8);return `<section class="hero page-hero"><div class="eyebrow">ROUND ROBIN PLAYOFFS</div><h1>PLAYOFFS</h1><p class="muted">Top 8 qualified from the completed league.</p></section><section class="card compact-section"><div class="section-head"><h2>Top 8 Qualifiers</h2><span class="notice ok">QUALIFIED</span></div><div class="players-grid">${q.map(x=>`<div class="player-card qual"><b>#${x.rank} ${esc(x.name)}</b><div class="small muted">${x.w} W Â· ${x.l} L Â· ${Math.round(x.wp*100)}%</div></div>`).join("")}</div></section>${rrCardsUI(t,p)}<section class="bracket">${playoffMatchCard(t,p.matches.sf1,"sf1")}${playoffMatchCard(t,p.matches.sf2,"sf2")}${playoffMatchCard(t,p.matches.final,"final")}</section>${resultSection(t)}`}
  const r=rankings(t),sky=r.filter(x=>x.team==="sky"),net=r.filter(x=>x.team==="net");return `<section class="hero page-hero"><div class="eyebrow">TEAM VS TEAM PLAYOFFS</div><h1>PLAYOFFS</h1><p class="muted">${t.playerCount>=16?"Ranks 1â€“2 are direct semifinal positions; ranks 3â€“6 enter qualifiers.":"Top 4 from each team qualify directly for the semifinals."}</p></section><section class="dual-team ranking-grid">${teamRank(t,"SKY SMASHERS","sky",sky)}${teamRank(t,"NET HUNTERS","net",net)}</section><section class="bracket">${t.playerCount>=16?`${playoffMatchCard(t,p.matches.q1,"q1")}${playoffMatchCard(t,p.matches.q2,"q2")}`:""}${playoffMatchCard(t,p.matches.sf1,"sf1")}${playoffMatchCard(t,p.matches.sf2,"sf2")}${playoffMatchCard(t,p.matches.final,"final")}</section>${resultSection(t)}`}
function submitPlayoff(key){const t=state.tournament,m=playoffState(t).matches[key],a=num($("#po-a-"+key)?.value,-1),b=num($("#po-b-"+key)?.value,-1);if(!m||a<0||b<0||a===b){alert("Enter two different non-negative scores.");return}m.score=[a,b];m.winner=a>b?m.sideA:m.sideB;const p=playoffState(t);if(key==="q1"&&p.matches.sf1.sideB==="Winner Q1")p.matches.sf1.sideB=m.winner;if(key==="q2"&&p.matches.sf2.sideB==="Winner Q2")p.matches.sf2.sideB=m.winner;if(key==="sf1")p.matches.final.sideA=m.winner;if(key==="sf2")p.matches.final.sideB=m.winner;if(key==="final"){p.champion=m.winner;p.finalScore=[a,b];p.completedAt=Date.now()}save();render()}
window.submitPlayoffScore=submitPlayoff;
function resultSection(t){const p=playoffState(t);if(!p.champion)return "";return `<section class="result-card"><div class="eyebrow">TOURNAMENT RESULT</div><div class="result-brand">SHUTTLE SYNDICATE</div><div class="result-type">${esc(t.type)}</div><div class="champion-label">CHAMPION</div><div class="champion-name">${esc(p.champion)}</div><div class="final-score">FINAL Â· ${p.finalScore[0]} â€” ${p.finalScore[1]}</div><button class="btn good wide" onclick="downloadResult()">DOWNLOAD RESULT</button></section>`}
function resultData(t){const p=playoffState(t),r=rankings(t);return {title:"SHUTTLE SYNDICATE",type:t.type,champion:p.champion,finalScore:p.finalScore,ranking:r,playoff:p,teams:t.teams,players:t.players}}
window.downloadResult=()=>{const t=state.tournament,p=playoffState(t);if(!p.champion)return;const d=resultData(t),rows=d.ranking.map(r=>`<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${r.gp}</td><td>${r.w}</td><td>${r.l}</td><td>${Math.round(r.wp*100)}%</td><td>${r.pf}</td><td>${r.pa}</td><td>${r.pd}</td></tr>`).join("");const playoffRows=Object.values(p.matches||{}).map(m=>`<div class="m"><b>${esc(m.label)}</b><span>${esc(m.sideA)} ${m.score?m.score[0]:"â€”"} vs ${m.score?m.score[1]:"â€”"} ${esc(m.sideB)}</span></div>`).join("");const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${t.type==="Round Robin"?1500:1050}" viewBox="0 0 1080 ${t.type==="Round Robin"?1500:1050}"><foreignObject x="0" y="0" width="1080" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;background:#071019;color:#eef7ff;min-height:100%;padding:54px;box-sizing:border-box"><div style="font-size:28px;font-weight:900;letter-spacing:4px">SHUTTLE SYNDICATE</div><div style="margin-top:8px;color:#8ea4b7;font-size:16px">${esc(t.type)} Â· TOURNAMENT RESULT</div><div style="margin-top:55px;color:#5ff0a0;font-size:18px;font-weight:900;letter-spacing:3px">CHAMPION</div><div style="font-size:56px;font-weight:950;margin-top:8px">${esc(p.champion)}</div><div style="font-size:32px;font-weight:900;margin-top:14px">FINAL Â· ${p.finalScore[0]} â€” ${p.finalScore[1]}</div><div style="margin-top:55px;font-size:22px;font-weight:900">PLAYOFFS</div>${playoffRows}<div style="margin-top:42px;font-size:22px;font-weight:900">FULL RANKING</div><table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px"><thead><tr>${["#","Player","M","W","L","Win %","PF","PA","Diff"].map(x=>`<th style="text-align:left;padding:9px;border-bottom:1px solid #294054">${x}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><div style="margin-top:45px;color:#718596;font-size:12px;letter-spacing:1px">Created by Irfan Shaik Â· ${APP_VERSION}</div></div></foreignObject></svg>`;const blob=new Blob([svg],{type:"image/svg+xml"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`Shuttle-Syndicate-${t.id}-Result.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function bindPage(){document.querySelectorAll(".nav button").forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render()});$("#adminHome")?.addEventListener("click",()=>{state.page="admin";window.location.hash="admin";render()});document.querySelectorAll("[data-present]").forEach(x=>x.onchange=()=>{const p=state.tournament.players.find(p=>p.id===x.dataset.present);if(p)p.present=x.checked;save();render()});$("#startLeague")?.addEventListener("click",()=>{const t=state.tournament,available=t.players.filter(p=>p.present===true);if(available.length<4){alert("At least 4 players must be available.");return}if(t.type==="Team vs Team"){const sky=available.filter(p=>p.team==="sky").length,net=available.filter(p=>p.team==="net").length;if(sky<2||net<2){alert("Team vs Team needs at least 2 available Sky players and 2 available Net players.");return}}t.started=true;const initial=assignInitialCourts(t);if(!initial.length){t.started=false;alert("No eligible game can be formed. Check in more players.");return}save();state.page="live";render()});$("#playerFilter")?.addEventListener("change",e=>{state.playerFilter=e.target.value;render()});document.querySelectorAll("[data-card-rank]").forEach(sel=>sel.onchange=()=>{const p=playoffState(state.tournament),rank=sel.dataset.cardRank;p.cards??={};const value=sel.value;const count=Object.entries(p.cards).filter(([r,n])=>r!==rank&&String(n)===value).length;if(value&&count>=2){alert(`Card ${value} already has two players.`);render();return}p.cards[rank]=value;const teams=[1,2,3,4].map(n=>playoffTeamFromCards(state.tournament,n));p.matches.sf1.sideA=teams[0].length===2?teams[0].join(" + "):"Team 1";p.matches.sf1.sideB=teams[2].length===2?teams[2].join(" + "):"Team 3";p.matches.sf2.sideA=teams[1].length===2?teams[1].join(" + "):"Team 2";p.matches.sf2.sideB=teams[3].length===2?teams[3].join(" + "):"Team 4";save();render()})}
function render(){if(state.page==="admin"){renderAdmin();return}const t=state.tournament;if(!t){state.page="admin";renderAdmin();return}const theme=t.type==="Team vs Team"?"tvt-theme":"rr-theme",content=state.page==="teams"?teamsPage(t):state.page==="live"?livePage(t):state.page==="schedule"?schedulePage(t):playoffPage(t);document.querySelector("#app").innerHTML=`<div class="app-shell ${theme}">${header(t)}<main class="container">${content}</main>${nav()}<div class="footer">Created by Irfan Shaik Â· ${APP_VERSION}</div></div>`;bindPage()}
load();const hash=window.location.hash;const params=new URLSearchParams(window.location.search);const boardQuery=params.get("board");if(hash==="#admin"){state.page="admin";state.shared=false;state.canScore=true;render()}else{const boardHash=hash.match(/^#board=(.+)$/);const id=boardQuery||(boardHash?decodeURIComponent(boardHash[1]):"");if(id){state.shared=true;state.canScore=false;state.page="teams";render();connectSharedTournament(id)}else if(state.tournament){state.shared=false;state.canScore=true;render()}else{state.page="admin";state.shared=false;state.canScore=true;render()}}



