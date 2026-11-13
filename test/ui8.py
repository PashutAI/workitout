from playwright.sync_api import sync_playwright
errs=[]
def consult(pg, slot, kcal='150', prot='34', scoops='1'):
    pg.get_by_role('button', name='Reconsult').first.click(); pg.wait_for_timeout(300)
    pg.select_option('#f-pw', slot)
    pg.fill('#f-pwk', kcal); pg.fill('#f-pwp', prot); pg.select_option('#f-pws', scoops)
    pg.locator('button.accent', has_text='Consult').click(); pg.wait_for_timeout(2200)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror',lambda e:errs.append('PE '+str(e)))
    pg.goto('file:///home/claude/workitout/dist/stub.html'); pg.wait_for_timeout(1500)
    # validation: slot chosen but no label values
    pg.get_by_role('button', name='Reconsult').first.click(); pg.wait_for_timeout(300)
    print('default slot:', pg.input_value('#f-pw'), '| kcal field:', repr(pg.input_value('#f-pwk')))
    pg.select_option('#f-pw','snack')
    pg.locator('button.accent', has_text='Consult').click(); pg.wait_for_timeout(500)
    print('validation:', pg.locator('.err').inner_text())
    pg.fill('#f-pwk','150'); pg.fill('#f-pwp','34')
    pg.locator('button.accent', has_text='Consult').click(); pg.wait_for_timeout(2200)
    if pg.evaluate('window.__WO_DEBUG.C.step')=='questions':
        pg.locator('button', has_text='Generate plan').click(); pg.wait_for_timeout(500)
    pg.locator('button', has_text='Confirm plan').click(); pg.wait_for_timeout(300)
    pg.locator('button', has_text='Yes, replace').click(); pg.wait_for_timeout(600)
    r=pg.evaluate("""()=>{const pl=window.__WO_DEBUG.S.docs.plan;return {profile:pl.profile.powder, shake:pl.plan.menus.map(m=>m.meals.filter(x=>/shake/i.test(x.title)).map(x=>x.slot+':'+x.kcal+'/'+x.protein).join()), guide:pl.plan.guidelines.filter(g=>/powder/i.test(g))}}""")
    print('saved profile powder:', r['profile']); print('shake per day:', r['shake']); print('guideline:', r['guide'])
    pg.evaluate("window.__WO_DEBUG.go('home')"); pg.wait_for_timeout(200)
    pg.locator('tr.today').click(); pg.wait_for_timeout(500)
    print('day page shows shake:', pg.locator('.meal', has_text='Protein shake').count(), '| kcal input value:', pg.locator('.meal', has_text='Protein shake').locator('input[type=number]').first.input_value())
    # reconsult form remembers values
    pg.evaluate("window.__WO_DEBUG.go('home')"); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Reconsult').first.click(); pg.wait_for_timeout(300)
    print('remembered:', pg.input_value('#f-pw'), pg.input_value('#f-pwk'), pg.input_value('#f-pwp'))
print('errors',errs)
