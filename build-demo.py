"""Gera demo/index.html a partir de app/index.html: a demonstracao publica do FinanceOS (sem login, dados de exemplo).
Rode depois de cada mudanca no app:  python build-demo.py
O que muda em relacao ao app: AUTH_ON desligado, service worker desligado, dados salvos em outra chave
(cf_site_demo, pra nao misturar com a conta de quem compra), sem manifest de instalacao, e um aviso
flutuante "Modo demonstracao" com o botao de compra (escondido quando a demo esta dentro da pagina de vendas)."""
import io, os, re, sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
src = io.open(os.path.join(RAIZ, 'app', 'index.html'), encoding='utf-8').read()
s = src
def rep(a, b, cnt=1):
    global s
    assert a in s, 'nao achei no app: ' + a[:70]
    s = s.replace(a, b, cnt)

rep('const AUTH_ON = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;', 'const AUTH_ON = false; // demo publica: sem login')
rep("navigator.serviceWorker.register('/app/sw.js')", "Promise.resolve() /* demo: sem service worker */")
rep('let STORE_KEY = "cf_app_demo";', 'let STORE_KEY = "cf_site_demo";')
rep('<link rel="manifest" href="/app/manifest.json">', '<meta name="robots" content="noindex">')
s = re.sub(r'<title>[^<]*</title>', '<title>FinanceOS · Demonstração</title>', s, count=1)

BANNER = r'''
<!-- ===== DEMONSTRACAO PUBLICA (gerado por build-demo.py) ===== -->
<style>
#demoBar{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:16px;background:rgba(12,12,34,.92);border:1px solid rgba(167,139,250,.45);box-shadow:0 18px 50px rgba(0,0,0,.55),0 0 0 1px rgba(124,58,237,.25);backdrop-filter:blur(10px);font-family:'Inter',system-ui,sans-serif;color:#e5e7ff;max-width:calc(100vw - 32px)}
#demoBar .t{font-size:13px;line-height:1.3}
#demoBar .t b{display:block;font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:#a78bfa}
#demoBar a{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;font-weight:800;font-size:13.5px;text-decoration:none;box-shadow:0 10px 26px rgba(124,58,237,.45);white-space:nowrap}
#demoBar button{background:none;border:0;color:#9aa0c7;font-size:18px;line-height:1;cursor:pointer;padding:4px}
@media(max-width:1000px){#demoBar{right:10px;left:10px;bottom:auto;top:10px;padding:8px 10px}#demoBar .t{font-size:12px}#demoBar .t span{display:none}#demoBar a{padding:9px 12px;font-size:12.5px}}
body.demo-embed #demoBar{display:none}
@media(max-width:1000px){body:has(#demoBar):not(.demo-embed){padding-top:64px}} /* celular: a barra nao cobre o cabecalho do app */
</style>
<div id="demoBar" role="note">
  <div class="t"><b>Modo demonstração</b><span>Dados de exemplo. Clique, lance um gasto, abra as telas.</span></div>
  <a href="https://pay.kiwify.com.br/ZLpUxIS" target="_blank" rel="noopener">Garantir acesso vitalício · R$ 49,90</a>
  <button type="button" aria-label="Fechar aviso" onclick="document.getElementById('demoBar').remove()">×</button>
</div>
<script>
try{ if(window.self!==window.top||/[?&]poster=1/.test(location.search))document.body.classList.add('demo-embed'); }catch(e){}
try{ window._consTem=function(){ return true; }; }catch(e){} /* demo: sem o aviso de LGPD (dados de exemplo) */
</script>
'''
rep('</body>', BANNER + '</body>')

out = os.path.join(RAIZ, 'demo', 'index.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
io.open(out, 'w', encoding='utf-8').write(s)
print('demo/index.html gerado:', len(s), 'bytes')
