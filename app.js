
let BASE_ORIGINAL=[],BASE=[],codigoAtivo=null,selecionados=new Map(),estado={},sugestaoGerada="",codigoPendente=null;
const $=id=>document.getElementById(id);

function norm(s){return String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[-_/.,;:()[\]{}]/g," ").replace(/\s+/g," ").trim()}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function js(s){return String(s??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
function lev(a,b){a=norm(a);b=norm(b);let p=Array.from({length:b.length+1},(_,i)=>i),c=[];for(let i=1;i<=a.length;i++){c[0]=i;for(let j=1;j<=b.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));[p,c]=[c,p]}return p[b.length]}
const ALIAS={estintor:"extintor",tacografo:"cronotacografo",tac:"cronotacografo",parabrisa:"para brisa"};

function score(text,q){
  const txt=norm(text),parts=norm(q).split(" ").filter(Boolean).map(x=>ALIAS[x]||x),tokens=txt.split(" ");let s=0;
  for(const p of parts){
    if(txt.includes(p)){s+=15;continue}
    if(p.length<=2)return-1;
    let best=99;for(const t of tokens){if(Math.abs(t.length-p.length)<=3)best=Math.min(best,lev(p,t))}
    const lim=p.length<=5?1:p.length<=9?2:3;if(best>lim)return-1;s+=8-best*2;
  }return s;
}
function grupos(){
  const m=new Map();
  for(const r of BASE){
    if(!m.has(r.codigoInfracao))m.set(r.codigoInfracao,{codigo:r.codigoInfracao,descricao:r.descricaoInfracao,fatos:[]});
    m.get(r.codigoInfracao).fatos.push(r);
  }return [...m.values()];
}
function buscar(q){
  return grupos().map(g=>[g,score([g.codigo,g.descricao,...g.fatos.flatMap(f=>[f.codigoFatoGerador,f.descricaoFatoGerador,f.casoEspecifico,f.observacaoBase])].join(" "),q)])
    .filter(x=>x[1]>=0).sort((a,b)=>b[1]-a[1]).slice(0,35).map(x=>x[0]);
}
function renderBusca(){
  const q=$("q").value.trim();if(!q){$("resultadosCodigos").innerHTML="";return}
  const arr=buscar(q);
  $("resultadosCodigos").innerHTML=arr.length?arr.map(g=>{
    const fatosRelacionados=g.fatos.filter(f=>score([f.codigoFatoGerador,f.descricaoFatoGerador,f.casoEspecifico,f.observacaoBase].join(" "),q)>=0);
    return `<div class="codigoCard" onclick="pedirCodigo('${js(g.codigo)}')"><b>Código ${esc(g.codigo)}</b><div>${esc(g.descricao)}</div><div class="meta">${fatosRelacionados.length} fato(s) gerador(es) relacionado(s) à pesquisa</div></div>`;
  }).join(""):"<p>Nenhum código encontrado.</p>";
}
$("q").oninput=renderBusca;

window.pedirCodigo=function(c){
  if(codigoAtivo&&codigoAtivo!==c&&selecionados.size){
    codigoPendente=c;$("textoTroca").textContent=`Deseja descartar os fatos geradores selecionados do código ${codigoAtivo} e selecionar o código ${c}?`;$("trocaCodigo").showModal();return;
  }ativarCodigo(c);
};
$("cancelarTroca").onclick=()=>{$("trocaCodigo").close();codigoPendente=null};
$("confirmarTroca").onclick=()=>{const c=codigoPendente;$("trocaCodigo").close();codigoPendente=null;limparSelecionados(false);ativarCodigo(c)};

function ativarCodigo(c){
  codigoAtivo=c;const fs=BASE.filter(r=>r.codigoInfracao===c);
  $("codigoAtivo").textContent=c;$("descricaoCodigo").textContent=fs[0]?.descricaoInfracao||"";
  const meds=[...new Set(fs.flatMap(f=>f.medidas||[]))];$("medidasCodigo").innerHTML=meds.map(m=>`<span class="tag">${esc(m)}</span>`).join("");
  $("codigoAtivoCard").classList.remove("hidden");renderFatos();$("codigoAtivoCard").scrollIntoView({behavior:"smooth",block:"start"});
}

function placeholders(obs){
  const out=[];let m;const rx=/#([^#]+)#/g;
  while((m=rx.exec(obs||""))){const raw=m[1].trim();if(raw&&!out.includes(raw))out.push(raw)}
  return out;
}
function inputVars(token){
  const vars=[];
  const patterns=[
    ["data",/DATA(?:\s+DA\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ ]+)?(?=,|;|\.|$)/i,"DATA","date"],
    ["ano",/\bANO\b/i,"Ano","year"],
    ["exercicio",/\bEXERCICIO[_ A-ZÇÃÕÉÍÓÚ]*\b/i,"Exercício/ano","year"],
    ["tamanho",/\bINFORMAR O TAMANHO[^,#]*/i,"Tamanho","text"],
    ["tempo",/\bTEMPO[_ A-ZÇÃÕÉÍÓÚ]*\b/i,"Tempo","text"],
    ["detalhar",/\bDETALHAR[^,#]*/i,"Detalhar","text"],
    ["descrever",/\bDESCREVER[^,#]*/i,"Descrever","text"],
    ["indicar",/\bINDICAR[^,#]*/i,"Indicar","text"],
    ["nome",/\bNOME DO [A-ZÇÃÕÉÍÓÚ ]+/i,"Nome","text"],
    ["inserir",/\bINSERIR [A-ZÇÃÕÉÍÓÚ ]+/i,"Informar","text"],
  ];
  for(const [id,rx,label,type] of patterns){if(rx.test(token))vars.push({id,label,type})}
  return vars;
}
function isPureInstruction(token){
  const n=norm(token);
  return /^(detalhar|descrever|indicar|informar|inserir|nome do|tempo_|exercicio_)/.test(n);
}
function tokenLabel(token){
  let s=String(token||"");
  s=s.replace(/DATA\s+DA\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ ]+(?=,|;|\.|$)/ig,"[DATA]");
  s=s.replace(/\bDATA\b/ig,"[DATA]")
    .replace(/\bANO\b/ig,"[ANO]")
    .replace(/\bEXERCICIO[_ A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]*\b/ig,"[EXERCÍCIO]")
    .replace(/\bINFORMAR O TAMANHO[^,#]*/ig,"[TAMANHO]")
    .replace(/\bDETALHAR[^,#]*/ig,"[DETALHAR]")
    .replace(/\bDESCREVER[^,#]*/ig,"[DESCREVER]")
    .replace(/\bINDICAR[^,#]*/ig,"[INDICAR]");
  return s.trim().toUpperCase();
}
function state(k){return estado[k]||(estado[k]={tokens:{},values:{},extra:""})}
function encData(s){return encodeURIComponent(String(s??""))}
function decData(s){try{return decodeURIComponent(s)}catch{return s}}

function specHtml(r){
  const st=state(r.codigoFatoGerador),toks=placeholders(r.observacaoBase);
  if(!toks.length)return `<div class="spec"><label class="fieldBox">Complemento / observação específica<input class="js-extra" data-k="${esc(encData(r.codigoFatoGerador))}" value="${esc(st.extra)}" placeholder="Opcional"></label></div>`;
  const choices=toks.filter(t=>!isPureInstruction(t));
  const fields=toks.filter(t=>isPureInstruction(t));
  return `<div class="spec"><b>Especificar a circunstância constatada</b>
    ${choices.length?`<div class="choices">${choices.map(t=>`<label class="choice"><input class="js-token" type="checkbox" data-k="${esc(encData(r.codigoFatoGerador))}" data-token="${esc(encData(t))}" ${st.tokens[t]?"checked":""}> ${esc(tokenLabel(t))}</label>`).join("")}</div>`:""}
    ${choices.filter(t=>st.tokens[t]).flatMap(t=>inputVars(t).map(v=>fieldHtml(r.codigoFatoGerador,t,v,st))).join("")}
    ${fields.flatMap(t=>inputVars(t).length?inputVars(t).map(v=>fieldHtml(r.codigoFatoGerador,t,v,st)):[`<div class="fieldBox"><label>${esc(t)}<input class="js-value" data-k="${esc(encData(r.codigoFatoGerador))}" data-key="${esc(encData(t))}" value="${esc(st.values[t]||"")}"></label></div>`]).join("")}
    <div class="fieldBox"><label>Complemento / outra circunstância<input class="js-extra" data-k="${esc(encData(r.codigoFatoGerador))}" value="${esc(st.extra)}" placeholder="Opcional"></label></div>
    <div class="preview"><b>Base da observação deste fato:</b> ${esc(r.observacaoBase)}</div>
  </div>`;
}
function fieldHtml(k,t,v,st){
  const key=t+"::"+v.id,val=st.values[key]||"",type=v.type==="date"?"date":v.type==="year"?"number":"text";
  return `<div class="fieldBox"><label>${esc(v.label)}<input class="js-value" data-k="${esc(encData(k))}" data-key="${esc(encData(key))}" type="${type}" ${type==="number"?'min="1900" max="2200"':''} value="${esc(val)}"></label></div>`;
}


function renderFatos(){
  const fs=BASE.filter(r=>r.codigoInfracao===codigoAtivo);
  $("fatosCodigo").innerHTML=fs.map(r=>{
    const sel=selecionados.has(r.codigoFatoGerador);
    return `<div class="fato ${sel?"selecionado":""}"><div class="factHead"><div><b>${esc(r.codigoFatoGerador)}</b> — ${esc(r.casoEspecifico)}</div><button class="${sel?"light":""}" onclick="toggleFato('${js(r.codigoFatoGerador)}')">${sel?"Remover":"Selecionar"}</button></div><div class="meta">${esc(r.descricaoFatoGerador)}</div>${sel?specHtml(r):""}</div>`;
  }).join("");
}
window.toggleFato=function(k){const r=BASE.find(x=>x.codigoFatoGerador===k);if(!r)return;if(selecionados.has(k))selecionados.delete(k);else{selecionados.set(k,r);state(k)}renderFatos();$("observacaoCard").classList.toggle("hidden",!selecionados.size)};
function syncEstadoFromDOM(){
  document.querySelectorAll("#fatosCodigo .js-token").forEach(el=>{
    const k=decData(el.dataset.k),t=decData(el.dataset.token),st=state(k);
    st.tokens[t]=!!el.checked;
    if(!el.checked){
      for(const key of Object.keys(st.values)) if(key.startsWith(t+"::")) delete st.values[key];
    }
  });
  document.querySelectorAll("#fatosCodigo .js-value").forEach(el=>{
    const k=decData(el.dataset.k),key=decData(el.dataset.key);
    state(k).values[key]=el.value;
  });
  document.querySelectorAll("#fatosCodigo .js-extra").forEach(el=>{
    const k=decData(el.dataset.k);
    state(k).extra=el.value;
  });
}

document.addEventListener("change",e=>{
  if(e.target?.classList?.contains("js-token")){
    const k=decData(e.target.dataset.k),t=decData(e.target.dataset.token),st=state(k);
    st.tokens[t]=!!e.target.checked;
    if(!e.target.checked){
      for(const key of Object.keys(st.values)) if(key.startsWith(t+"::")) delete st.values[key];
    }
    // Re-render only to expose/hide date/detail fields belonging to the selected token.
    renderFatos();
  }
});
document.addEventListener("input",e=>{
  if(e.target?.classList?.contains("js-value")){
    state(decData(e.target.dataset.k)).values[decData(e.target.dataset.key)]=e.target.value;
  }else if(e.target?.classList?.contains("js-extra")){
    state(decData(e.target.dataset.k)).extra=e.target.value;
  }
});

function substituirVariaveis(text,t,st){
  let out=t;
  for(const v of inputVars(t)){
    const key=t+"::"+v.id,val=st.values[key]||"";
    if(!val)continue;
    if(v.id==="data"){
      const [y,m,d]=val.split("-");const br=(d&&m&&y)?`${d}/${m}/${y}`:val;
      out=out.replace(/DATA(?:\s+DA\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ ]+)?(?=,|;|\.|$)/i,br);
    }else if(v.id==="ano"||v.id==="exercicio"){
      out=out.replace(v.id==="ano"?/\bANO\b/i:/\bEXERCICIO[_ A-ZÇÃÕÉÍÓÚ]*/i,val);
    }else if(v.id==="tamanho"){
      out=out.replace(/\bINFORMAR O TAMANHO[^,#]*/i,val);
    }else if(v.id==="detalhar"){
      out=out.replace(/\bDETALHAR[^,#]*/i,val);
    }else if(v.id==="descrever"){
      out=out.replace(/\bDESCREVER[^,#]*/i,val);
    }else if(v.id==="indicar"){
      out=out.replace(/\bINDICAR[^,#]*/i,val);
    }else if(v.id==="nome"){
      out=out.replace(/\bNOME DO [A-ZÇÃÕÉÍÓÚ ]+/i,val);
    }else if(v.id==="inserir"){
      out=out.replace(/\bINSERIR [A-ZÇÃÕÉÍÓÚ ]+/i,val);
    }
  }
  return out;
}
function observacaoFato(r){
  const st=state(r.codigoFatoGerador);
  if(String(r.codigoFatoGerador)==="606.02"){
    const equipamentos=[];
    for(const t of placeholders(r.observacaoBase)){
      if(!isPureInstruction(t)&&st.tokens[t]) equipamentos.push(t.replace(/^(o|a|os|as)\s+/i,"").trim());
    }
    if(st.extra.trim()) equipamentos.push(st.extra.trim());
    const lista=equipamentos.filter(Boolean);
    if(lista.length) return `NO MOMENTO DA FISCALIZAÇÃO, FICOU CONSTATADO QUE O MOTORISTA DO VEÍCULO EM SERVIÇO DEMONSTROU FALTA DE CAPACIDADE TÉCNICA PARA OPERAR O VEÍCULO NO(S) EQUIPAMENTO(S): ${lista.join("; ").toUpperCase()}.`;
    return "NO MOMENTO DA FISCALIZAÇÃO, FICOU CONSTATADO QUE O MOTORISTA DO VEÍCULO EM SERVIÇO DEMONSTROU FALTA DE CAPACIDADE TÉCNICA PARA OPERAR EQUIPAMENTO(S) DO VEÍCULO — ESPECIFICAR O(S) EQUIPAMENTO(S).";
  }
  const obs=r.observacaoBase||r.descricaoFatoGerador||r.casoEspecifico;
  let out=obs.replace(/#([^#]+)#/g,(m,t)=>{
    t=t.trim();
    if(isPureInstruction(t)){
      const direct=st.values[t]; if(direct)return direct;
      const vars=inputVars(t);
      if(vars.length){let rep=t;for(const v of vars){const key=t+"::"+v.id;if(st.values[key])rep=substituirVariaveis(rep,t,st)}return vars.some(v=>st.values[t+"::"+v.id])?rep:""}
      return "";
    }
    if(!st.tokens[t])return "";
    return substituirVariaveis(t,t,st);
  }).replace(/\s+/g," ").replace(/\s+([,.;:])/g,"$1").trim();
  if(st.extra.trim())out+=(out.endsWith(".")?" ":"; ")+st.extra.trim()+(st.extra.trim().endsWith(".")?"":".");
  return out.toUpperCase();
}
function gerarObs(scroll=true){
  if(!selecionados.size)return;
  syncEstadoFromDOM();
  const texts=[...selecionados.values()].map(observacaoFato).filter(Boolean);
  sugestaoGerada=texts.join(" ");
  $("obs").value=sugestaoGerada;
  $("obs").readOnly=true;
  $("observacaoCard").classList.remove("hidden");
  if(scroll)$("observacaoCard").scrollIntoView({behavior:"smooth"});
}
$("gerarObs").onclick=()=>gerarObs(true);
$("atualizarObs").onclick=()=>{
  // Lê novamente TODAS as opções visíveis, descarta o texto anterior e reconstrói.
  syncEstadoFromDOM();
  sugestaoGerada="";
  $("obs").value="";
  $("obs").readOnly=true;
  gerarObs(true);
};$("editarObs").onclick=()=>{$("obs").readOnly=false;$("obs").focus()};
$("copiarObs").onclick=async()=>{await navigator.clipboard.writeText($("obs").value);const b=$("copiarObs"),old=b.textContent;b.textContent="Copiado!";setTimeout(()=>b.textContent=old,900)};

function limparSelecionados(scroll=true){selecionados.clear();estado={};sugestaoGerada="";$("obs").value="";$("observacaoCard").classList.add("hidden");renderFatos();if(scroll)$("codigoAtivoCard").scrollIntoView({behavior:"smooth"})}
$("limparSelecao").onclick=()=>limparSelecionados();
$("novaPesquisaLimpar").onclick=()=>{
  const tem=$("q").value.trim()||codigoAtivo||selecionados.size||$("obs").value.trim();
  if(tem&&!confirm("Deseja iniciar uma nova pesquisa? A busca, o código ativo, os fatos selecionados, as circunstâncias preenchidas e a observação serão apagados."))return;
  $("q").value="";$("resultadosCodigos").innerHTML="";codigoAtivo=null;codigoPendente=null;selecionados.clear();estado={};sugestaoGerada="";$("obs").value="";$("codigoAtivoCard").classList.add("hidden");$("observacaoCard").classList.add("hidden");$("q").focus();window.scrollTo({top:0,behavior:"smooth"});
};

function validarBase(a){return Array.isArray(a)&&a.length&&a.every(r=>r.codigoInfracao&&r.codigoFatoGerador)}
$("importarBase").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const a=JSON.parse(await f.text());if(!validarBase(a))throw 0;localStorage.setItem("consulta6074_lite_base_v03",JSON.stringify(a));BASE=a;$("statusBase").textContent=`Base importada: ${a.length} fatos geradores.`;alert("Base atualizada.")}catch{alert("Arquivo inválido.")}e.target.value=""};
$("restaurarBase").onclick=()=>{if(!confirm("Restaurar a base original desta versão?"))return;localStorage.removeItem("consulta6074_lite_base_v03");BASE=[...BASE_ORIGINAL];$("statusBase").textContent=`Base original restaurada: ${BASE.length} fatos geradores.`};

async function init(){
  BASE_ORIGINAL=await(await fetch("infracoes_6074.json")).json();
  try{const l=JSON.parse(localStorage.getItem("consulta6074_lite_base_v03")||"null");BASE=validarBase(l)?l:BASE_ORIGINAL}catch{BASE=BASE_ORIGINAL}
  $("statusBase").textContent=`${BASE.length} fatos geradores carregados a partir da nova tabela.`;
}
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");
init();


// ===== v0.8 — tratamento próprio dos fatos 999.1 / 999.2 / 999.3 =====
(function v08(){
  const specHtmlBase = specHtml;
  const observacaoFatoBase = observacaoFato;

  function fld(k,key,label,type="text",placeholder=""){
    const st=state(k),val=st.values["V08::"+key]||"";
    return `<div class="fieldBox"><label>${esc(label)}
      <input class="js-value" data-k="${esc(encData(k))}" data-key="${esc(encData("V08::"+key))}" type="${type}" value="${esc(val)}" placeholder="${esc(placeholder)}">
    </label></div>`;
  }
  function choicePessoa(k){
    const st=state(k),v=st.values["V08::tipoPessoa"]||"";
    return `<div class="choices">
      <label class="choice"><input type="radio" name="tp-${esc(k)}" ${v==="FÍSICA"?"checked":""} onchange="state('${js(k)}').values['V08::tipoPessoa']='FÍSICA'"> PESSOA FÍSICA</label>
      <label class="choice"><input type="radio" name="tp-${esc(k)}" ${v==="JURÍDICA"?"checked":""} onchange="state('${js(k)}').values['V08::tipoPessoa']='JURÍDICA'"> PESSOA JURÍDICA</label>
    </div>`;
  }

  specHtml = function(r){
    const k=String(r.codigoFatoGerador);
    if(k==="999.3"){
      return `<div class="spec"><b>DADOS PARA A OBSERVAÇÃO</b>
        ${fld(k,"origem","ORIGEM")}
        ${fld(k,"destino","DESTINO")}
        ${fld(k,"passageiros","Nº DE PASSAGEIROS PAGANTES","number")}
        ${fld(k,"valor","VALOR MÉDIO COBRADO (R$)","text","EX.: 400,00")}
        ${fld(k,"extra","COMPLEMENTO / OUTRA INFORMAÇÃO")}
        <div class="preview"><b>BASE DA OBSERVAÇÃO DESTE FATO:</b> EXECUÇÃO DE SERVIÇO CLANDESTINO.</div>
      </div>`;
    }
    if(k==="999.1"){
      return `<div class="spec"><b>DADOS PARA A OBSERVAÇÃO</b>
        ${choicePessoa(k)}
        ${fld(k,"nome","NOME DA PESSOA")}
        ${fld(k,"documento","CPF/CNPJ")}
        ${fld(k,"local","LOCAL DA OFERTA (SITE, PLATAFORMA, APLICATIVO ETC.)")}
        ${fld(k,"origem","ORIGEM")}
        ${fld(k,"destino","DESTINO")}
        ${fld(k,"valor","VALOR MÉDIO COBRADO (R$)")}
        ${fld(k,"tipoServico","TIPO DE SERVIÇO OFERTADO")}
        ${fld(k,"extra","COMPLEMENTO / OUTRA INFORMAÇÃO")}
      </div>`;
    }
    if(k==="999.2"){
      return `<div class="spec"><b>DADOS PARA A OBSERVAÇÃO</b>
        ${choicePessoa(k)}
        ${fld(k,"nome","NOME DA PESSOA")}
        ${fld(k,"documento","CPF/CNPJ")}
        ${fld(k,"local","LOCAL DA COMERCIALIZAÇÃO")}
        ${fld(k,"origem","ORIGEM")}
        ${fld(k,"destino","DESTINO")}
        ${fld(k,"valor","VALOR MÉDIO COBRADO (R$)")}
        ${fld(k,"executor","QUEM EXECUTARIA O SERVIÇO")}
        ${fld(k,"tipoServico","TIPO DE SERVIÇO COMERCIALIZADO")}
        ${fld(k,"extra","COMPLEMENTO / OUTRA INFORMAÇÃO")}
      </div>`;
    }
    return specHtmlBase(r);
  };

  function vv(k,key){return (state(k).values["V08::"+key]||"").trim()}
  function money(v){if(!v)return"";return /^r\$/i.test(v)?v:`R$ ${v}`}

  observacaoFato = function(r){
    const k=String(r.codigoFatoGerador);

    if(k==="999.3"){
      const origem=vv(k,"origem"),destino=vv(k,"destino"),pass=vv(k,"passageiros"),valor=vv(k,"valor"),extra=vv(k,"extra");
      let s="NO MOMENTO DA FISCALIZAÇÃO, FICOU CONSTATADO QUE O VEÍCULO ESTAVA REALIZANDO TRANSPORTE REMUNERADO INTERESTADUAL";
      if(pass) s+=` DE ${pass} PASSAGEIRO(S) PAGANTE(S)`;
      if(origem||destino) s+=` ENTRE ${origem||"[ORIGEM]"} E ${destino||"[DESTINO]"}`;
      if(valor) s+=`, COBRANDO VALOR MÉDIO DE ${money(valor)}`;
      s+=", SEM AUTORIZAÇÃO OU PERMISSÃO DA ANTT PARA COMERCIALIZAR OU PRESTAR ESSE TIPO DE SERVIÇO.";
      if(extra) s+=" "+extra.toUpperCase()+(extra.endsWith(".")?"":".");
      return s;
    }

    if(k==="999.1"){
      const tipo=vv(k,"tipoPessoa"),nome=vv(k,"nome"),doc=vv(k,"documento"),local=vv(k,"local"),
            origem=vv(k,"origem"),destino=vv(k,"destino"),valor=vv(k,"valor"),tipoSrv=vv(k,"tipoServico"),extra=vv(k,"extra");
      let sujeito=[tipo?`PESSOA ${tipo}`:"PESSOA",nome].filter(Boolean).join(" ");
      let s=`NO MOMENTO DA FISCALIZAÇÃO, FICOU CONSTATADO QUE ${sujeito}`;
      if(doc)s+=`, CPF/CNPJ ${doc}`;
      s+=" ESTAVA OFERTANDO";
      if(local)s+=` EM ${local}`;
      s+=" SERVIÇO";
      if(origem||destino)s+=` ENTRE ${origem||"[ORIGEM]"} E ${destino||"[DESTINO]"}`;
      if(valor)s+=`, PELO VALOR MÉDIO DE ${money(valor)}`;
      if(tipoSrv)s+=`, DO TIPO ${tipoSrv}`;
      s+=", SEM AUTORIZAÇÃO OU PERMISSÃO DA ANTT PARA COMERCIALIZAR OU PRESTAR ESSE TIPO DE SERVIÇO.";
      if(extra)s+=" "+extra.toUpperCase()+(extra.endsWith(".")?"":".");
      return s;
    }

    if(k==="999.2"){
      const tipo=vv(k,"tipoPessoa"),nome=vv(k,"nome"),doc=vv(k,"documento"),local=vv(k,"local"),
            origem=vv(k,"origem"),destino=vv(k,"destino"),valor=vv(k,"valor"),exec=vv(k,"executor"),tipoSrv=vv(k,"tipoServico"),extra=vv(k,"extra");
      let sujeito=[tipo?`PESSOA ${tipo}`:"PESSOA",nome].filter(Boolean).join(" ");
      let s=`NO MOMENTO DA FISCALIZAÇÃO, FICOU CONSTATADO QUE ${sujeito}`;
      if(doc)s+=`, CPF/CNPJ ${doc}`;
      s+=" ESTAVA COMERCIALIZANDO";
      if(local)s+=` EM ${local}`;
      s+=" SERVIÇO";
      if(origem||destino)s+=` ENTRE ${origem||"[ORIGEM]"} E ${destino||"[DESTINO]"}`;
      if(valor)s+=`, PELO VALOR MÉDIO DE ${money(valor)}`;
      if(exec)s+=`, A SER EXECUTADO POR ${exec}`;
      if(tipoSrv)s+=`, DO TIPO ${tipoSrv}`;
      s+=", SEM AUTORIZAÇÃO OU PERMISSÃO DA ANTT PARA COMERCIALIZAR OU PRESTAR ESSE TIPO DE SERVIÇO.";
      if(extra)s+=" "+extra.toUpperCase()+(extra.endsWith(".")?"":".");
      return s;
    }

    return observacaoFatoBase(r);
  };

  // Corrige o texto-base exibido no 999.3 para não induzir a redação antiga.
  const renderFatosBase = renderFatos;
  renderFatos = function(){
    renderFatosBase();
    document.querySelectorAll(".fato.selecionado").forEach(el=>{
      const txt=el.textContent||"";
      if(txt.includes("999.3")){
        const prev=el.querySelector(".preview");
        if(prev)prev.innerHTML="<b>BASE DA OBSERVAÇÃO DESTE FATO:</b> EXECUÇÃO DE SERVIÇO CLANDESTINO. OS CAMPOS ACIMA SÃO DADOS DA OCORRÊNCIA, E NÃO CIRCUNSTÂNCIAS.";
      }
    });
  };
})();


// ===== Beta 0.8.1 — atualização explícita para grupo de teste =====
(function betaUpdate(){
  let regRef=null;
  if("serviceWorker" in navigator){
    navigator.serviceWorker.ready.then(reg=>{
      regRef=reg;
      // Em uso com internet, procura uma revisão nova a cada abertura.
      reg.update().catch(()=>{});
    });
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if(sessionStorage.getItem("consulta6074_recarregar_apos_update")==="1"){
        sessionStorage.removeItem("consulta6074_recarregar_apos_update");
        location.reload();
      }
    });
  }

  $("verificarApp")?.addEventListener("click",async()=>{
    const box=$("statusApp");
    if(!navigator.onLine){
      box.textContent="SEM INTERNET. O APP CONTINUA FUNCIONANDO COM A VERSÃO INSTALADA.";
      return;
    }
    try{
      box.textContent="VERIFICANDO ATUALIZAÇÃO...";
      const reg=regRef || await navigator.serviceWorker.ready;
      const before=reg.installing || reg.waiting;
      await reg.update();
      await new Promise(r=>setTimeout(r,900));
      if(reg.waiting){
        sessionStorage.setItem("consulta6074_recarregar_apos_update","1");
        reg.waiting.postMessage({type:"SKIP_WAITING"});
        box.textContent="NOVA VERSÃO ENCONTRADA. ATUALIZANDO...";
      }else if(reg.installing && reg.installing!==before){
        box.textContent="NOVA VERSÃO ENCONTRADA. AGUARDE A INSTALAÇÃO.";
      }else{
        box.textContent="APP ATUALIZADO. VERSÃO 0.8.1 BETA.";
      }
    }catch(e){
      box.textContent="NÃO FOI POSSÍVEL VERIFICAR AGORA. TENTE NOVAMENTE MAIS TARDE.";
    }
  });

  $("recarregarApp")?.addEventListener("click",()=>location.reload());
})();
