require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.SESSION_SECRET || "";
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const DB_PATH = path.resolve(process.env.DATABASE_FILE || "./data/reports.sqlite");

if (SECRET.length < 32) throw new Error("Set SESSION_SECRET to at least 32 characters in .env");
if (!ADMIN_HASH.startsWith("$2")) throw new Error("Set ADMIN_PASSWORD_HASH in .env; see README.md");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"], connectSrc: ["'self'"], objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: "no-referrer" }
}));
app.use(express.json({ limit: "12kb" }));
app.use(express.urlencoded({ extended: false, limit: "12kb" }));
app.use(session({
  name: "diag_admin",
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 2 * 60 * 60 * 1000
  }
}));

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at TEXT NOT NULL,
 ip_address TEXT NOT NULL,
 user_agent TEXT,
 platform TEXT,
 browser TEXT,
 device_type TEXT,
 device_model TEXT,
 language TEXT,
 timezone TEXT,
 screen_resolution TEXT,
 viewport_size TEXT,
 cpu_cores INTEGER,
 touch_points INTEGER,
 cookie_count INTEGER,
 local_storage_count INTEGER,
 local_storage_bytes INTEGER,
 session_storage_count INTEGER,
 session_storage_bytes INTEGER,
 indexeddb_count INTEGER,
 consent_version TEXT NOT NULL
);`);

const submitLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false });

function str(v, max=120) {
  return typeof v === "string" ? v.replace(/[\\u0000-\\u001f\\u007f]/g, "").trim().slice(0,max) || null : null;
}
function int(v, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}
function csrf(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString("hex");
  return req.session.csrf;
}
function checkCsrf(req,res,next) {
  const a = Buffer.from(String(req.body.csrf || ""));
  const b = Buffer.from(String(req.session.csrf || ""));
  if (!b.length || a.length !== b.length || !crypto.timingSafeEqual(a,b))
    return res.status(403).json({error:"Request expired. Refresh and try again."});
  next();
}
function admin(req,res,next) {
  if (req.session.isAdmin === true) return next();
  res.status(401).json({error:"Sign in required."});
}

app.use(express.static(path.join(__dirname,"public"), { index:"index.html" }));

app.post("/api/report", submitLimiter, (req,res) => {
  const b = req.body || {};
  if (b.consent !== true || b.consentVersion !== "2026-01")
    return res.status(400).json({error:"Consent is required."});
  const d = b.device || {}, s = b.storage || {};
  const ip = str(req.ip || req.socket.remoteAddress || "unknown",64) || "unknown";
  const stmt = db.prepare(`INSERT INTO reports (
    created_at,ip_address,user_agent,platform,browser,device_type,device_model,
    language,timezone,screen_resolution,viewport_size,cpu_cores,touch_points,
    cookie_count,local_storage_count,local_storage_bytes,session_storage_count,
    session_storage_bytes,indexeddb_count,consent_version
  ) VALUES (
    @created_at,@ip_address,@user_agent,@platform,@browser,@device_type,@device_model,
    @language,@timezone,@screen_resolution,@viewport_size,@cpu_cores,@touch_points,
    @cookie_count,@local_storage_count,@local_storage_bytes,@session_storage_count,
    @session_storage_bytes,@indexeddb_count,@consent_version
  )`);
  const saved = stmt.run({
    created_at:new Date().toISOString(), ip_address:ip,
    user_agent:str(req.get("user-agent"),300), platform:str(d.platform,100),
    browser:str(d.browser,100), device_type:str(d.deviceType,40),
    device_model:str(d.deviceModel,100), language:str(d.language,40),
    timezone:str(d.timezone,80), screen_resolution:str(d.screenResolution,40),
    viewport_size:str(d.viewportSize,40), cpu_cores:int(d.cpuCores,256),
    touch_points:int(d.touchPoints,50), cookie_count:int(s.cookieCount,500),
    local_storage_count:int(s.localStorageCount,500),
    local_storage_bytes:int(s.localStorageBytes,5000000),
    session_storage_count:int(s.sessionStorageCount,500),
    session_storage_bytes:int(s.sessionStorageBytes,5000000),
    indexeddb_count:int(s.indexedDbCount,500), consent_version:"2026-01"
  });
  res.json({ok:true, reportId:saved.lastInsertRowid, redirect:"https://www.amazon.in/"});
});

app.get("/api/admin/csrf",(req,res)=>res.json({csrf:csrf(req)}));
app.post("/api/admin/login",loginLimiter,checkCsrf,async(req,res)=>{
  const user = str(req.body.username,80) || "";
  const pass = typeof req.body.password === "string" ? req.body.password : "";
  if (user !== ADMIN_USER || !(await bcrypt.compare(pass,ADMIN_HASH)))
    return res.status(401).json({error:"Incorrect username or password."});
  req.session.regenerate(err=>{
    if(err) return res.status(500).json({error:"Could not create session."});
    req.session.isAdmin = true;
    req.session.csrf = crypto.randomBytes(24).toString("hex");
    res.json({ok:true});
  });
});
app.get("/api/admin/reports",admin,(req,res)=>{
  res.json({reports:db.prepare("SELECT * FROM reports ORDER BY id DESC LIMIT 1000").all(),csrf:csrf(req)});
});
app.get("/api/admin/export.csv",admin,(req,res)=>{
  const rows=db.prepare("SELECT * FROM reports ORDER BY id DESC").all();
  const cols=rows.length?Object.keys(rows[0]):["id","created_at","ip_address","user_agent","platform","browser","device_type","device_model","language","timezone","screen_resolution","viewport_size","cpu_cores","touch_points","cookie_count","local_storage_count","local_storage_bytes","session_storage_count","session_storage_bytes","indexeddb_count","consent_version"];
  const cell=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const csv=[cols.map(cell).join(","),...rows.map(r=>cols.map(k=>cell(r[k])).join(","))].join("\\r\\n");
  res.setHeader("Content-Type","text/csv; charset=utf-8");
  res.setHeader("Content-Disposition",'attachment; filename="device-reports.csv"');
  res.send(csv);
});
app.post("/api/admin/logout",admin,checkCsrf,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("/admin/login",(req,res)=>res.sendFile(path.join(__dirname,"public","login.html")));
app.listen(PORT,()=>console.log(`Running at http://localhost:${PORT}`));
