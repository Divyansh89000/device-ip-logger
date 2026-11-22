let all=[],csrf="";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function load(){try{const r=await fetch("/api/admin/reports");if(r.status===401){location.href="/admin/login";return;}const d=await r.json();all=d.reports;csrf=d.csrf;render();}catch(e){$("error").textContent="Could not load reports.";}}
function render(){const q=$("search").value.toLowerCase();const rows=all.filter(x=>JSON.stringify(x).toLowerCase().includes(q));$("rows").innerHTML=rows.map(x=>`<tr><td>#${esc(x.id)}<small>${esc(new Date(x.created_at).toLocaleString())}</small></td><td>${esc(x.ip_address)}</td><td>${esc(x.device_type)} · ${esc(x.platform)}<small>${esc(x.device_model)}</small></td><td>${esc(x.browser)}</td><td>${esc(x.screen_resolution)}</td><td>Cookies ${esc(x.cookie_count)}<small>Local ${esc(x.local_storage_count)} · Session ${esc(x.session_storage_count)} · IDB ${esc(x.indexeddb_count)}</small></td></tr>`).join("")||'<tr><td colspan="6">No matching reports.</td></tr>';}
$("search").addEventListener("input",render);$("refresh").addEventListener("click",load);
$("logout").addEventListener("click",async()=>{await fetch("/api/admin/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({csrf})});location.href="/admin/login";});
load();