from playwright.sync_api import sync_playwright
import json
errs=[];reqs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror',lambda e:errs.append('PE '+str(e)))
    def handle(route):
        r=route.request; reqs.append((r.headers,r.post_data))
        route.fulfill(status=200,headers={'access-control-allow-origin':'*','content-type':'application/json'},
          body=json.dumps({'content':[{'type':'text','text':'{"questions":["Any pain at night?"],"areas":["knee"],"diet":[],"calorie_adjust":0,"coach_note":"Mock coach note."}'}]}))
    pg.route('https://api.anthropic.com/**',handle)
    pg.goto('file:///home/claude/workitout/dist/index.html'); pg.wait_for_timeout(1200)
    print('sample notice:',pg.locator('text=sample program').count(),'| key card:',pg.locator('#ai-key').count())
    print('no personal text:', 'Shoulder' not in pg.inner_text('body'), '82' not in pg.inner_text('.goal') )
    pg.fill('#ai-key','sk-ant-test'); pg.get_by_text('Save key').click(); pg.wait_for_timeout(200)
    print('status',pg.locator('.saved-note').last.inner_text())
    pg.get_by_role('button', name='Reconsult').first.click(); pg.wait_for_timeout(300)
    pg.fill('#f-limits','left knee clicks on stairs')
    pg.locator('button.accent',has_text='Consult').click(); pg.wait_for_timeout(2500)
    print('step',pg.evaluate('window.__WO_DEBUG.C.step'),'| questions',pg.evaluate('window.__WO_DEBUG.C.questions.map(q=>q.q)'))
    h,body=reqs[0]; bj=json.loads(body)
    print('hdrs',h.get('x-api-key'),h.get('anthropic-version'),h.get('anthropic-dangerous-direct-browser-access'),'| model',bj['model'],'| prompt has limit:', 'left knee' in bj['messages'][0]['content'])
    # key not in backup
    pg.evaluate("window.__WO_DEBUG.go('home')"); pg.wait_for_timeout(300)
    print('key in docs:', 'sk-ant' in json.dumps(pg.evaluate('window.__WO_DEBUG.S.docs')))
    b.close()
print('\n'.join(errs) or 'no errors')
