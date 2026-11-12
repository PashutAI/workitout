from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror',lambda e:errs.append('PE '+str(e)))
    pg.goto('file:///home/claude/workitout/dist/stub.html'); pg.wait_for_timeout(1500)
    pg.evaluate("""()=>{const S=window.__WO_DEBUG.S;S.docs.plan.plan=window.WO.generatePlan(Object.assign({},window.WO.DEFAULT_PROFILE,{goal:'chest_arms',strengthDays:4}),{});}""")
    # find a date (within next 14 days) whose workout has a superset
    ds=pg.evaluate("""()=>{const D=window.__WO_DEBUG,S=D.S;const plan=S.docs.plan.plan;
      const y=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
      for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()+i);const e=plan.schedule[d.getDay()];
        if(e&&e.ref&&(plan.workouts[e.ref].exercises||[]).some(x=>x.key.indexOf('ss_')===0)) return y(d);}
      return null}""")
    print('superset day',ds)
    pg.evaluate("window.__WO_DEBUG.go('day-%s')"%ds); pg.wait_for_timeout(500)
    ss=pg.locator('.ex',has_text='superset')
    print('superset rows',ss.count())
    for i in range(ss.count()):
        r=ss.nth(i)
        print(i, r.locator('h3').inner_text(), '| fields', r.locator('.ld input').count(), '|', r.locator('.ex-meta').inner_text().replace('\n',' '), '|', r.locator('.ex-note').inner_text())
    arms=pg.locator('.ex',has_text='Arms superset').first
    ins=arms.locator('.ld input')
    ins.nth(0).fill('60'); ins.nth(1).fill('45')
    arms.locator('.setbox').click(); pg.wait_for_timeout(400)
    print('timer state:', arms.locator('.setbox').get_attribute('class'), arms.locator('.setbox .num').inner_text())
    d=pg.evaluate("""()=>{const S=window.__WO_DEBUG.S;const t=Object.keys(S.docs).filter(k=>k.startsWith('d_')).sort().pop();return S.docs[t].loads}""")
    print('stored',d)
    # reload view: values persist
    pg.evaluate("window.__WO_DEBUG.go('home')"); pg.wait_for_timeout(200)
    pg.evaluate("window.__WO_DEBUG.go('day-%s')"%ds); pg.wait_for_timeout(300)
    a2=pg.locator('.ex',has_text='Arms superset').first.locator('.ld input')
    print('after revisit', [a2.nth(i).input_value() for i in range(a2.count())])
    ch=pg.locator('.ex',has_text='Chest superset').first.locator('.ld')
    print('chest labels', [ch.nth(i).inner_text().replace('\n',' ') for i in range(ch.count())])
print('errors',errs)
