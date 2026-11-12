import sys
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror',lambda e:errs.append('PE '+str(e)))
    pg.on('console',lambda m:errs.append('C '+m.text) if m.type=='error' else None)
    pg.goto('file:///home/claude/workitout/dist/stub.html'); pg.wait_for_timeout(1500)
    print('home rows',pg.locator('tr.row-day').count(),'today',pg.locator('tr.today').count(),'cells',pg.locator('.cal-cell').count())
    pg.screenshot(path='/tmp/home.png',full_page=True)
    # day page
    pg.locator('tr.today').click(); pg.wait_for_timeout(500)
    print('hash',pg.evaluate('location.hash'))
    sb=pg.locator('.setbox')
    print('setboxes',sb.count())
    if sb.count():
        sb.first.click(); pg.wait_for_timeout(600)
        print('counting',pg.locator('.setbox.counting').count())
    pg.locator('.checks input').first.check()
    pg.fill('#fb','too easy'); pg.wait_for_timeout(1200)
    pg.screenshot(path='/tmp/day.png',full_page=True)
    pg.locator('.back').first.click(); pg.wait_for_timeout(400)
    print('back hash',pg.evaluate('location.hash'))
    # consult
    pg.get_by_role('button', name='Reconsult').first.click(); pg.wait_for_timeout(400)
    pg.click('text=Consult >> nth=-1') if False else None
    pg.locator('button.accent', has_text='Consult').click(); pg.wait_for_timeout(2500)
    print('step', pg.evaluate('window.__WO_DEBUG.C.step'))
    if pg.evaluate('window.__WO_DEBUG.C.step')=='questions':
        pg.locator('button', has_text='Generate plan').click(); pg.wait_for_timeout(500)
    pg.screenshot(path='/tmp/review.png',full_page=True)
    pg.locator('button', has_text='Confirm plan').click(); pg.wait_for_timeout(300)
    print('modal',pg.locator('.modal').count())
    pg.locator('button', has_text='Yes, replace').click(); pg.wait_for_timeout(500)
    print('after hash',pg.evaluate('location.hash'),'rows',pg.locator('tr.row-day').count())
    # tracking click: start day is tracking day
    pg.locator('.cal-cell.today').click(); pg.wait_for_timeout(400)
    print('checkin modal',pg.locator('.modal').count(), pg.locator('.trk').count())
    pg.screenshot(path='/tmp/checkin.png')
    pg.locator('button', has_text='Save tracking').click(); pg.wait_for_timeout(300)
    print('store keys',pg.evaluate('Object.keys(window.__store)'))
    b.close()
print('\n'.join(errs) or 'no errors')
