from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror',lambda e:errs.append('PE '+str(e)))
    pg.goto('file:///home/claude/workitout/dist/stub.html'); pg.wait_for_timeout(1500)
    # seed: program started 14 days ago; two earlier Monday B logs
    pg.evaluate("""()=>{const D=window.__WO_DEBUG,S=D.S;
      const y=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
      const a=new Date();a.setDate(a.getDate()-14);const b=new Date();b.setDate(b.getDate()-7);
      S.docs.plan.start=y(a);
      S.docs['d_'+y(a)]={date:y(a),sets:{},checks:{},last:{},meals:{},cnt:{},mealVals:{},loads:{latpd:90,row:80,bench:40},feedback:'',done:false};
      S.docs['d_'+y(b)]={date:y(b),sets:{},checks:{},last:{},meals:{},cnt:{},mealVals:{},loads:{latpd:100,row:85,bench:45},feedback:'',done:false};
      D.go('day-'+y(new Date()));}""")
    pg.wait_for_timeout(500)
    lp=pg.locator('#ld-latpd')
    print('prefill',lp.input_value(), pg.locator('.ld .last').first.inner_text())
    print('no field for plank/crunch:', pg.locator('#ld-plank').count(), pg.locator('#ld-crunch').count())
    lp.fill('105')
    # log first set of lat pulldown -> stored
    pg.locator('.ex').first.locator('.setbox').click(); pg.wait_for_timeout(300)
    # leave row prefilled, log a set -> auto store 85
    pg.locator('.ex').nth(1).locator('.setbox').click(); pg.wait_for_timeout(300)
    d=pg.evaluate("""()=>{const S=window.__WO_DEBUG.S;const t=Object.keys(S.docs).filter(k=>k.startsWith('d_')).sort().pop();return S.docs[t].loads}""")
    print('stored today',d)
    pg.evaluate("window.__WO_DEBUG.go('home')"); pg.wait_for_timeout(300)
    pg.locator('.cal-cell.today').click(); pg.wait_for_timeout(400)
    print([r for r in pg.locator('table.meas').first.inner_text().split('\n') if r.strip()][:8] if pg.locator('table.meas').count() else 'no table')
    for lab in ['Too easy','OK','No issues','Mostly']: pg.locator('.modal .seg button',has_text=lab).first.click()
    pg.locator('button',has_text='Get recommendations').click(); pg.wait_for_timeout(2500)
    print('recs',pg.locator('.recs').first.inner_text().replace('\n',' | '))
    pg.locator('button',has_text='Reconsult with').click(); pg.wait_for_timeout(300)
    r=pg.evaluate("""()=>{const D=window.__WO_DEBUG;return 1}""")
    pg.locator('button.accent',has_text='Consult').click(); pg.wait_for_timeout(2500)
    if pg.evaluate("window.__WO_DEBUG.C.step")=='questions': pg.locator('button',has_text='Skip').click(); pg.wait_for_timeout(400)
    print('review plan loads:',pg.evaluate("""()=>{const p=window.__WO_DEBUG.C.plan;const o={};Object.values(p.workouts).forEach(w=>(w.exercises||[]).forEach(e=>{o[e.key]=e.weight}));return o}"""))
    b.close()
print('\n'.join(errs) or 'no errors')
