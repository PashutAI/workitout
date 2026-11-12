from playwright.sync_api import sync_playwright
import json
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':844},accept_downloads=True)
    pg.on('pageerror',lambda e:errs.append('PE '+str(e)))
    pg.goto('file:///home/claude/workitout/dist/index.html'); pg.wait_for_timeout(1500)
    print('mode chip:',pg.locator('#sync').inner_text(), '| data card:',pg.locator('text=saved in this browser only').count())
    pg.locator('tr.today').click(); pg.wait_for_timeout(300)
    pg.fill('#fb','my note'); pg.wait_for_timeout(1000)
    pg.locator('.back').first.click(); pg.wait_for_timeout(300)
    with pg.expect_download() as d: pg.get_by_text('Download backup').click()
    path='/tmp/bk.json'; d.value.save_as(path)
    j=json.load(open(path)); print('backup docs',sorted(j['docs'].keys()))
    # wipe and restore
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(1200)
    pg.locator('input[type=file]').set_input_files(path); pg.wait_for_timeout(400)
    print('modal',pg.locator('.modal h2').inner_text())
    pg.get_by_text('Yes, restore').click(); pg.wait_for_timeout(600)
    pg.locator('tr.today').click(); pg.wait_for_timeout(300)
    print('restored note:',pg.input_value('#fb'))
    pg.locator('.back').first.click(); pg.wait_for_timeout(300)
    open('/tmp/bad.json','w').write('{"hi":1}')
    pg.locator('input[type=file]').set_input_files('/tmp/bad.json'); pg.wait_for_timeout(400)
    print('bad toast:',pg.locator('.toast').inner_text())
    b.close()
print('\n'.join(errs) or 'no errors')
