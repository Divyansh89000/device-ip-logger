const $ = id => document.getElementById(id);
function browserName(ua) {
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/CriOS\//.test(ua)) return "Chrome (iOS)";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Unknown";
}
function osName(ua, platform) {
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS / iPadOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua) || /Linux/i.test(platform)) return "Linux";
  return platform || "Unknown";
}
function storageInfo(store) {
  try {
    let bytes=0;
    for(let i=0;i<store.length;i++){
      const k=store.key(i); const v=store.getItem(k) || "";
      bytes += new Blob([k,v]).size;
    }
    return {count:store.length,bytes};
  } catch { return {count:null,bytes:null}; }
}
async function indexedDbCount() {
  try {
    if (indexedDB.databases) return (await indexedDB.databases()).length;
  } catch {}
  return null;
}
function collect() {
  const ua=navigator.userAgent || "";
  const platform=navigator.userAgentData?.platform || navigator.platform || "";
  const deviceType=/tablet|ipad/i.test(ua) ? "Tablet" : (/mobile|android|iphone/i.test(ua) ? "Mobile" : "Desktop");
  const model=navigator.userAgentData?.model || "Not provided by browser";
  const local=storageInfo(localStorage), session=storageInfo(sessionStorage);
  const cookieCount=document.cookie ? document.cookie.split(";").filter(Boolean).length : 0;
  return {
    device:{
      platform:osName(ua,platform), browser:browserName(ua), deviceType, deviceModel:model,
      language:navigator.language || "Unknown",
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
      screenResolution:`${screen.width} × ${screen.height}`,
      viewportSize:`${innerWidth} × ${innerHeight}`,
      cpuCores:navigator.hardwareConcurrency || null,
      touchPoints:navigator.maxTouchPoints || 0
    },
    storage:{
      cookieCount, localStorageCount:local.count, localStorageBytes:local.bytes,
      sessionStorageCount:session.count, sessionStorageBytes:session.bytes,
      indexedDbCount:null
    }
  };
}
const report=collect();
const fields=[
  ["Operating system",report.device.platform],["Browser",report.device.browser],
  ["Device type",report.device.deviceType],["Device model",report.device.deviceModel],
  ["Language",report.device.language],["Time zone",report.device.timezone],
  ["Screen resolution",report.device.screenResolution],["Viewport",report.device.viewportSize],
  ["CPU cores",report.device.cpuCores ?? "Not available"],["Touch points",report.device.touchPoints],
  ["Cookies on this site",report.storage.cookieCount],
  ["LocalStorage entries",report.storage.localStorageCount ?? "Unavailable"],
  ["SessionStorage entries",report.storage.sessionStorageCount ?? "Unavailable"]
];
$("details").innerHTML=fields.map(([k,v])=>`<div class="item"><span>${escapeHtml(k)}</span><b>${escapeHtml(String(v))}</b></div>`).join("");
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("continue").addEventListener("click",async()=>{
  const btn=$("continue"), err=$("error");
  btn.disabled=true; btn.textContent="Submitting…"; err.textContent="";
  try {
    report.storage.indexedDbCount=await indexedDbCount();
    const res=await fetch("/api/report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...report,consent:true,consentVersion:"2026-01"})});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error || "Could not submit report.");
    btn.textContent="Submitted — redirecting…";
    location.assign("https://www.amazon.in/");
  } catch(e) {
    err.textContent=e.message || "Something went wrong.";
    btn.disabled=false; btn.textContent="Continue";
  }
});