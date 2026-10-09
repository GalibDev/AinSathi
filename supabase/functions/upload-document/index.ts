import { createClient } from 'npm:@supabase/supabase-js@2'
const json=(body:unknown,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Vary':'Origin'}})
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')??''
  const allowed=(Deno.env.get('ALLOWED_ORIGINS')??'http://127.0.0.1:5173').split(',')
  if(origin&&!allowed.includes(origin))return json({error:'Origin not permitted'},403)
  if(req.method==='OPTIONS')return new Response(null,{headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Vary':'Origin'}})
  if(req.method!=='POST')return json({error:'POST required'},405,origin)
  let path:string|null=null
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const user=createClient(url,key,{global:{headers:{Authorization:req.headers.get('authorization')??''}},auth:{persistSession:false}})
  const storage=createClient(url,secret,{auth:{persistSession:false}})
  try{
    const {data:auth,error:authError}=await user.auth.getUser()
    if(authError||!auth.user)return json({error:'Authentication required'},401,origin)
    if(Number(req.headers.get('content-length')??0)>11*1024*1024)return json({error:'File too large'},413,origin)
    const form=await req.formData(),file=form.get('file'),org=form.get('organization_id'),caseId=form.get('case_id')
    if(!(file instanceof File)||typeof org!=='string'||typeof caseId!=='string'||file.size<1||file.size>10*1024*1024)return json({error:'Valid case and file (max 10 MB) required'},400,origin)
    const {data:member}=await user.from('organization_members').select('role').eq('organization_id',org).eq('user_id',auth.user.id).single()
    const {data:record}=await user.from('cases').select('id').eq('organization_id',org).eq('id',caseId).is('archived_at',null).single()
    if(!record||!member||!['owner','admin','lawyer','assistant'].includes(member.role))return json({error:'Access denied'},403,origin)
    const bytes=new Uint8Array(await file.arrayBuffer())
    const mime=bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46?'application/pdf':bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10?'image/png':bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'image/jpeg':null
    if(!mime||mime!==file.type)return json({error:'Only valid PDF, JPG and PNG allowed'},400,origin)
    const {count,error:rateError}=await user.from('case_documents').select('id',{count:'exact',head:true}).eq('uploaded_by',auth.user.id).gte('created_at',new Date(Date.now()-600000).toISOString())
    if(rateError)throw rateError
    if((count??0)>=20)return json({error:'Too many uploads. Try again later.'},429,origin)
    const ext=mime==='application/pdf'?'pdf':mime==='image/png'?'png':'jpg'
    path=org+'/'+caseId+'/'+crypto.randomUUID()+'.'+ext
    const {error:uploadError}=await storage.storage.from('case-documents').upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'0'})
    if(uploadError)throw uploadError
    const {data:document,error}=await user.from('case_documents').insert({organization_id:org,case_id:caseId,name:file.name.slice(0,200),storage_path:path,mime_type:mime,size_bytes:file.size,uploaded_by:auth.user.id}).select().single()
    if(error)throw error
    path=null
    return json({document},200,origin)
  }catch{
    if(path){const cleanup=await storage.storage.from('case-documents').remove([path]);if(cleanup.error)return json({error:'Upload failed; an orphaned file may require administrator cleanup.'},500,origin)}
    return json({error:'Upload failed. Please try again.'},500,origin)
  }
})
