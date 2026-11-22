async function getCsrf(){const r=await fetch("/api/admin/csrf");return (await r.json()).csrf;}
document.getElementById("login").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget),error=document.getElementById("error");
 try{const token=await getCsrf();const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:f.get("username"),password:f.get("password"),csrf:token})});const d=await r.json();if(!r.ok)throw new Error(d.error);location.href="/admin";}
 catch(x){error.textContent=x.message||"Sign in failed.";}
});