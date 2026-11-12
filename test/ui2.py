from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844},permissions=['clipboard-read','clipboard-write'])
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append('PE '+str(e)))
    pg.clock.install()
    pg.goto('file:///home/claude/workitout/dist/stub.html'); pg.clock.run_for(2000)
    pg.locator('tr.today').click(); pg.clock.run_for(500)
    # warm-up timed items
    print('timed controls',pg.locator('.timed').count())
    first=pg.locator('.timed .tbtn').first
    print('first btn',first.inner_text())
    first.click(); pg.clock.run_for(1000)
    print('running',first.inner_text())
    pg.clock.run_for(185000)
    print('after',first.inner_text(), 'checked', pg.locator('li:has-text("3 min general") input').is_checked())
    # reps set counter (band pull-apart 2 x 15)
    b2=pg.locator('li:has-text("Band pull-apart") .tbtn'); print('reps btn',b2.inner_text())
    b2.click(); b2.click(); print('after2',b2.inner_text(),pg.locator('li:has-text("Band pull-apart") input').is_checked())
    # stretch hold 2 x 30 per arm => 4
    sb=pg.locator('li:has-text("Wall biceps") .tbtn'); print('stretch',sb.inner_text(), pg.locator('li:has-text("Wall biceps") .tcnt').inner_text())
    sb.click(); pg.clock.run_for(31000); print('hold1',pg.locator('li:has-text("Wall biceps") .tcnt').inner_text())
    # notes limit
    pg.fill('#fb','x'*990)
    print('cnt',pg.locator('#fb ~ .cnt-row .cnt, .notefield:has(#fb) .cnt').first.inner_text())
    pg.evaluate("navigator.clipboard.writeText('y'.repeat(50))")
    pg.focus('#fb'); pg.keyboard.press('End'); pg.keyboard.press('Control+V')
    print('len after paste',pg.evaluate("document.getElementById('fb').value.length"), pg.locator('.cnt-msg').first.inner_text()[:60])
    pg.keyboard.type('z'*30)
    print('len after typing',pg.evaluate("document.getElementById('fb').value.length"))
    # meal edit
    pg.locator('#m-breakfast').check()
    ki=pg.locator('.meal:has(#m-breakfast) .mk2 input').first; ki.fill('500')
    print('chip',pg.locator('.fuel-totals .chip').nth(2).inner_text(), 'reset visible', pg.locator('.meal:has(#m-breakfast) .undo').is_visible())
    pg.screenshot(path='/tmp/day2.png',full_page=True)
    # touch base: shift start 14 days back and seed notes
    pg.evaluate("""()=>{const D=window.__WO_DEBUG;const S=D.S;const d=new Date();d.setDate(d.getDate()-14);
      const y=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
      S.docs.plan.start=y(d);
      const d2=new Date();d2.setDate(d2.getDate()-3);const k='d_'+y(d2);
      S.docs[k]={date:y(d2),sets:{},checks:{},last:{},meals:{pre:true,breakfast:true,lunch:true},cnt:{},mealVals:{},feedback:'Too easy. Left knee clicked.',done:false};
      S.docs['t_'+y(d)]={date:y(d),checks:{},values:{waist:87,weight:82,bodyfat:16},joints:'Tight',notes:'16% fat',saved:true};
      D.go('home');}""")
    pg.locator('.cal-cell.today').click(); pg.clock.run_for(500)
    print('modal text:',pg.locator('.modal').inner_text()[:900].replace('\n',' | '))
    for lab,i in [('Too easy',0),('OK',0),('No issues',0),('Mostly',0)]:
        pg.locator('.modal .seg button',has_text=lab).first.click()
    pg.locator('button',has_text='Get recommendations').click(); pg.clock.run_for(3000)
    print('recs:',pg.locator('.recs').first.inner_text().replace('\n',' | '))
    pg.screenshot(path='/tmp/touch.png',full_page=True)
    b.close()
print('\n'.join(errs) or 'no errors')
